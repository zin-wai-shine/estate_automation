import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { CustomDropdown } from '../../components/ui/CustomDropdown';
import type { DropdownOption } from '../../components/ui/CustomDropdown';
import {
  FiCpu,
  FiPlay,
  FiRefreshCw,
  FiCheckCircle,
  FiFacebook,
  FiFileText,
  FiImage,
  FiSettings,
  FiInfo,
  FiActivity,
  FiZoomIn,
  FiZoomOut,
  FiMaximize2,
  FiMinimize2,
  FiMove,
  FiCrosshair,
  FiZap,
} from 'react-icons/fi';

interface WorkflowNode {
  id: string;
  type: 'trigger' | 'ai' | 'content_branch' | 'image_branch' | 'output';
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  x: number;
  y: number;
  enabled: boolean;
  model?: string;
  badgeText: string;
  badgeVariant: 'info' | 'success' | 'warning' | 'default';
  description: string;
}

interface WorkflowMapViewProps {
  onNavigateToFacebookLogin?: () => void;
}

const LOCAL_STORAGE_KEY = 'estate_automate_workflow_config_v4';
const API_ENDPOINT = 'http://localhost:8085/api/workflow/config';

const getAIModelMetadata = (modelKey: string) => {
  switch (modelKey) {
    case 'gpt-4o':
      return {
        title: 'ChatGPT 4o Engine',
        subtitle: 'OpenAI Core',
        badgeText: 'OpenAI',
        badgeVariant: 'info' as const,
        icon: <FiCpu style={{ color: '#10B981' }} />,
        description: 'Processes DALL-E image enhancement & multi-modal property analysis.',
      };
    case 'gemini-1.5-pro':
      return {
        title: 'Gemini 1.5 Pro Engine',
        subtitle: 'Google AI Core',
        badgeText: 'Google AI',
        badgeVariant: 'warning' as const,
        icon: <FiZap style={{ color: 'var(--accent-primary)' }} />,
        description: 'Generates high-converting Thai/English rental copy, hashtags, & Line ID CTA.',
      };
    case 'claude-3-5-sonnet':
      return {
        title: 'Claude 3.5 Sonnet Engine',
        subtitle: 'Anthropic Core',
        badgeText: 'Anthropic',
        badgeVariant: 'success' as const,
        icon: <FiCpu style={{ color: '#F59E0B' }} />,
        description: 'Advanced reasoning, precise Thai real estate copywriting & translation.',
      };
    case 'dall-e-3':
      return {
        title: 'DALL-E 3 Vision Engine',
        subtitle: 'OpenAI Image AI',
        badgeText: 'Vision AI',
        badgeVariant: 'info' as const,
        icon: <FiImage style={{ color: '#10B981' }} />,
        description: 'Generates photo-realistic property staging & image upscaling.',
      };
    case 'stability-xl':
      return {
        title: 'Stability SDXL Engine',
        subtitle: 'Stability AI Core',
        badgeText: 'Stability',
        badgeVariant: 'default' as const,
        icon: <FiImage style={{ color: '#8B5CF6' }} />,
        description: 'High-speed image background removal & logo watermark overlay.',
      };
    default:
      return {
        title: `${modelKey} Engine`,
        subtitle: 'AI Core Provider',
        badgeText: 'AI Core',
        badgeVariant: 'info' as const,
        icon: <FiCpu style={{ color: 'var(--accent-primary)' }} />,
        description: 'AI processing engine node.',
      };
  }
};

const getInitialDefaultNodes = (): WorkflowNode[] => [
  {
    id: 'input-trigger',
    type: 'trigger',
    title: 'Facebook URL Importer',
    subtitle: 'Input Trigger Node',
    icon: <FiFacebook style={{ color: '#1877F2' }} />,
    x: 40,
    y: 190,
    enabled: true,
    badgeText: 'Trigger',
    badgeVariant: 'info',
    description: 'Scrapes raw listing post URL from Facebook Groups & Marketplace.',
  },
  {
    id: 'ai-chatgpt',
    type: 'ai',
    title: 'ChatGPT 4o Engine',
    subtitle: 'OpenAI Core',
    icon: <FiCpu style={{ color: '#10B981' }} />,
    x: 350,
    y: 60,
    enabled: true,
    model: 'gpt-4o',
    badgeText: 'OpenAI',
    badgeVariant: 'info',
    description: 'Processes DALL-E image enhancement & multi-modal property analysis.',
  },
  {
    id: 'ai-gemini',
    type: 'ai',
    title: 'Gemini 1.5 Pro Engine',
    subtitle: 'Google AI Core',
    icon: <FiZap style={{ color: 'var(--accent-primary)' }} />,
    x: 350,
    y: 300,
    enabled: true,
    model: 'gemini-1.5-pro',
    badgeText: 'Google AI',
    badgeVariant: 'warning',
    description: 'Generates high-converting Thai/English rental copy, hashtags, & Line ID CTA.',
  },
  {
    id: 'content-path',
    type: 'content_branch',
    title: 'Content Generation Path',
    subtitle: 'Copywriting & Translation',
    icon: <FiFileText style={{ color: 'var(--accent-primary)' }} />,
    x: 680,
    y: 300,
    enabled: true,
    model: 'gemini-1.5-pro',
    badgeText: 'Branch A',
    badgeVariant: 'success',
    description: 'Receives input from Gemini 1.5 Pro Engine to construct marketing copy.',
  },
  {
    id: 'image-path',
    type: 'image_branch',
    title: 'Image Processing Path',
    subtitle: 'AI Enhance & R2 Storage',
    icon: <FiImage style={{ color: '#10B981' }} />,
    x: 680,
    y: 60,
    enabled: true,
    model: 'gpt-4o',
    badgeText: 'Branch B',
    badgeVariant: 'success',
    description: 'Receives input from ChatGPT 4o Vision to upscale & watermark listing images.',
  },
  {
    id: 'output-publish',
    type: 'output',
    title: 'Review & Auto-Publish',
    subtitle: 'Output Destination',
    icon: <FiCheckCircle style={{ color: 'var(--status-success)' }} />,
    x: 1010,
    y: 190,
    enabled: true,
    badgeText: 'Destination',
    badgeVariant: 'info',
    description: 'Prepares approved listings for Facebook Pages & TikTok queue.',
  },
];

const loadSynchronousLocalConfig = () => {
  try {
    const localSaved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (localSaved) {
      const parsed = JSON.parse(localSaved);
      if (parsed.nodes && Array.isArray(parsed.nodes)) {
        const defaultNodes = getInitialDefaultNodes();
        const mergedNodes = defaultNodes.map((defNode) => {
          const savedNode = parsed.nodes.find((sn: any) => sn.id === defNode.id);
          if (savedNode) {
            const savedModel = savedNode.model || defNode.model;
            let metaProps = {};
            if (defNode.type === 'ai' && savedModel) {
              const meta = getAIModelMetadata(savedModel);
              metaProps = {
                title: meta.title,
                subtitle: meta.subtitle,
                badgeText: meta.badgeText,
                badgeVariant: meta.badgeVariant,
                icon: meta.icon,
                description: meta.description,
              };
            }
            return {
              ...defNode,
              ...metaProps,
              x: savedNode.x ?? defNode.x,
              y: savedNode.y ?? defNode.y,
              enabled: savedNode.enabled ?? defNode.enabled,
              model: savedModel,
            };
          }
          return defNode;
        });
        return {
          nodes: mergedNodes,
          zoom: typeof parsed.zoom === 'number' ? parsed.zoom : 1.0,
          panOffset: parsed.panOffset || { x: 0, y: 0 },
        };
      }
    }
  } catch (e) {}

  return {
    nodes: getInitialDefaultNodes(),
    zoom: 1.0,
    panOffset: { x: 0, y: 0 },
  };
};

export const WorkflowMapView: React.FC<WorkflowMapViewProps> = ({
  onNavigateToFacebookLogin = () => {},
}) => {
  // Synchronously initialize Facebook connection state from cache (default true to prevent layout flash)
  const [isFbConnected, setIsFbConnected] = useState<boolean>(() => {
    try {
      const cached = localStorage.getItem('estate_automate_fb_connected');
      return cached === null ? true : cached === 'true';
    } catch (e) {
      return true;
    }
  });
  const [checkingFbStatus, setCheckingFbStatus] = useState<boolean>(true);

  // Synchronously initialize state from localStorage
  const initialConfig = loadSynchronousLocalConfig();
  const [nodes, setNodes] = useState<WorkflowNode[]>(initialConfig.nodes);
  const [zoom, setZoom] = useState<number>(initialConfig.zoom);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>(initialConfig.panOffset);
  const [isConfigLoaded, setIsConfigLoaded] = useState<boolean>(false);

  // Selected node for settings modal inspector
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [testRunMessage, setTestRunMessage] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPanning, setIsPanning] = useState(false);

  // Refs for dragging & panning mouse calculations
  const startPanRef = useRef({ x: 0, y: 0 });
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const startNodeDragRef = useRef({ mouseX: 0, mouseY: 0, nodeX: 0, nodeY: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  const aiModelOptions: DropdownOption[] = [
    { value: 'gpt-4o', label: 'ChatGPT (gpt-4o)' },
    { value: 'gemini-1.5-pro', label: 'Google Gemini 1.5 Pro' },
    { value: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet' },
    { value: 'dall-e-3', label: 'OpenAI DALL-E 3 (Vision)' },
    { value: 'stability-xl', label: 'Stability AI SDXL' },
  ];

  // Dynamic AI Engine Routing Logic
  const chatgptNodeObj = nodes.find((n) => n.id === 'ai-chatgpt');
  const geminiNodeObj = nodes.find((n) => n.id === 'ai-gemini');
  const contentNodeObj = nodes.find((n) => n.id === 'content-path');
  const imageNodeObj = nodes.find((n) => n.id === 'image-path');

  const isChatGPTActive = chatgptNodeObj?.enabled ?? false;
  const isGeminiActive = geminiNodeObj?.enabled ?? false;
  const isContentPathActive = contentNodeObj?.enabled ?? false;
  const isImagePathActive = imageNodeObj?.enabled ?? false;

  const chatgptModel = chatgptNodeObj?.model || 'gpt-4o';
  const geminiModel = geminiNodeObj?.model || 'gemini-1.5-pro';

  // Determine active provider for Content Path (Gemini preferred -> Fallback to ChatGPT)
  let activeContentAIProvider: 'gemini' | 'chatgpt' | null = null;
  if (isGeminiActive) {
    activeContentAIProvider = 'gemini';
  } else if (isChatGPTActive) {
    activeContentAIProvider = 'chatgpt';
  }

  // Determine active provider for Image Path (ChatGPT preferred -> Fallback to Gemini)
  let activeImageAIProvider: 'chatgpt' | 'gemini' | null = null;
  if (isChatGPTActive) {
    activeImageAIProvider = 'chatgpt';
  } else if (isGeminiActive) {
    activeImageAIProvider = 'gemini';
  }

  // Load saved workflow configuration on mount
  useEffect(() => {
    const checkFbAndLoadConfig = async () => {
      // 1. Check Facebook status in background
      try {
        const res = await fetch('http://localhost:8085/api/social/facebook/browser/status');
        const data = await res.json();
        if (data.is_connected !== undefined) {
          const isConn = Boolean(data.is_connected);
          setIsFbConnected(isConn);
          try {
            localStorage.setItem('estate_automate_fb_connected', String(isConn));
          } catch (e) {}
        }
      } catch (e) {
        // Retain current connection state
      } finally {
        setCheckingFbStatus(false);
      }

      // 2. Sync with backend API database/file
      try {
        const res = await fetch(API_ENDPOINT);
        const data = await res.json();
        if (data.has_saved_config && data.nodes && Array.isArray(data.nodes)) {
          setNodes((defaultNodes) =>
            defaultNodes.map((defNode) => {
              const savedNode = data.nodes.find((sn: any) => sn.id === defNode.id);
              if (savedNode) {
                const savedModel = savedNode.model || defNode.model;
                let metaProps = {};
                if (defNode.type === 'ai' && savedModel) {
                  const meta = getAIModelMetadata(savedModel);
                  metaProps = {
                    title: meta.title,
                    subtitle: meta.subtitle,
                    badgeText: meta.badgeText,
                    badgeVariant: meta.badgeVariant,
                    icon: meta.icon,
                    description: meta.description,
                  };
                }
                return {
                  ...defNode,
                  ...metaProps,
                  x: savedNode.x ?? defNode.x,
                  y: savedNode.y ?? defNode.y,
                  enabled: savedNode.enabled ?? defNode.enabled,
                  model: savedModel,
                };
              }
              return defNode;
            })
          );
          if (typeof data.zoom === 'number') setZoom(data.zoom);
          if (data.panOffset) setPanOffset(data.panOffset);
        }
      } catch (err) {
      } finally {
        setIsConfigLoaded(true);
      }
    };

    checkFbAndLoadConfig();
  }, []);

  // Auto-save changes ONLY after initial configuration has finished loading
  useEffect(() => {
    if (!isConfigLoaded) return;

    const configToSave = {
      nodes: nodes.map((n) => ({
        id: n.id,
        x: n.x,
        y: n.y,
        enabled: n.enabled,
        model: n.model,
      })),
      zoom,
      panOffset,
    };

    // 1. Save to LocalStorage
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(configToSave));
    } catch (e) {}

    // 2. Save to Backend API
    fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(configToSave),
    }).catch(() => {});
  }, [nodes, zoom, panOffset, isConfigLoaded]);

  const resetNodeLayout = () => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    setZoom(1.0);
    setPanOffset({ x: 0, y: 0 });
    const defaultNodes = getInitialDefaultNodes();
    setNodes(defaultNodes);

    // Save reset state to backend
    fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nodes: defaultNodes.map((n) => ({ id: n.id, x: n.x, y: n.y, enabled: true, model: n.model })),
        zoom: 1.0,
        panOffset: { x: 0, y: 0 },
      }),
    }).catch(() => {});
  };

  // Canvas Mouse Down: Pan canvas when clicking on empty background
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    setIsPanning(true);
    startPanRef.current = {
      x: e.clientX - panOffset.x,
      y: e.clientY - panOffset.y,
    };
  };

  // Node Mouse Down: Start moving a specific node card
  const handleNodeMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    setDraggingNodeId(id);
    startNodeDragRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      nodeX: node.x,
      nodeY: node.y,
    };
  };

  // Canvas Mouse Move: Handles BOTH canvas panning AND node dragging
  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPanOffset({
        x: e.clientX - startPanRef.current.x,
        y: e.clientY - startPanRef.current.y,
      });
      return;
    }

    if (draggingNodeId) {
      const dx = (e.clientX - startNodeDragRef.current.mouseX) / zoom;
      const dy = (e.clientY - startNodeDragRef.current.mouseY) / zoom;
      const newX = Math.round(startNodeDragRef.current.nodeX + dx);
      const newY = Math.round(startNodeDragRef.current.nodeY + dy);

      setNodes((prev) =>
        prev.map((n) => (n.id === draggingNodeId ? { ...n, x: newX, y: newY } : n))
      );
    }
  };

  const handleCanvasMouseUp = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
  };

  // Handle Mouse Wheel Zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.05 : -0.05;
    setZoom((prev) => Math.max(0.5, Math.min(1.8, Math.round((prev + delta) * 100) / 100)));
  };

  // Toggle path connection on/off right on node card!
  const togglePathConnection = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, enabled: !n.enabled } : n))
    );
  };

  const handleModelSelectForNode = (nodeId: string, newModel: string) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id === nodeId) {
          if (n.type === 'ai') {
            const meta = getAIModelMetadata(newModel);
            return {
              ...n,
              model: newModel,
              title: meta.title,
              subtitle: meta.subtitle,
              badgeText: meta.badgeText,
              badgeVariant: meta.badgeVariant,
              icon: meta.icon,
              description: meta.description,
            };
          }
          return { ...n, model: newModel };
        }
        return n;
      })
    );

    if (selectedNode && selectedNode.id === nodeId) {
      setSelectedNode((prev) => {
        if (!prev) return null;
        if (prev.type === 'ai') {
          const meta = getAIModelMetadata(newModel);
          return {
            ...prev,
            model: newModel,
            title: meta.title,
            subtitle: meta.subtitle,
            badgeText: meta.badgeText,
            badgeVariant: meta.badgeVariant,
            icon: meta.icon,
            description: meta.description,
          };
        }
        return { ...prev, model: newModel };
      });
    }
  };

  const runTestPipeline = () => {
    setIsTesting(true);
    setTestRunMessage('Executing visual workflow test pipeline...');

    setTimeout(() => {
      setIsTesting(false);
      if (!isFbConnected) {
        setTestRunMessage(
          '⚠️ Pipeline Execution Blocked: Facebook account is disconnected. Automated extractions are stopped until Facebook session is connected.'
        );
        return;
      }

      if (!isContentPathActive && !isImagePathActive) {
        setTestRunMessage('Both Content and Image branches bypassed/disconnected.');
        return;
      }

      let statusStr = 'Multi-AI Pipeline Executed: ';
      if (isContentPathActive) {
        if (activeContentAIProvider === 'gemini') {
          statusStr += `Content Path (${geminiModel}) • `;
        } else if (activeContentAIProvider === 'chatgpt') {
          statusStr += `Content Path (Auto-Rerouted to ${chatgptModel}) • `;
        } else {
          statusStr += 'Content Path (No AI available) • ';
        }
      }

      if (isImagePathActive) {
        if (activeImageAIProvider === 'chatgpt') {
          statusStr += `Image Path (${chatgptModel}) • `;
        } else if (activeImageAIProvider === 'gemini') {
          statusStr += `Image Path (Auto-Rerouted to ${geminiModel}) • `;
        } else {
          statusStr += 'Image Path (No AI available) • ';
        }
      }

      statusStr += 'Output destination ready!';
      setTestRunMessage(statusStr);
    }, 1200);
  };

  // Precise Handle Endpoints (Card Width: 260px, Socket Centers: 75px / 50px / 100px)
  const getOutputHandle = (id: string, offsetY = 75) => {
    const node = nodes.find((n) => n.id === id);
    if (!node) return { x: 0, y: 0 };
    return {
      x: node.x + 260,
      y: node.y + offsetY,
    };
  };

  const getInputHandle = (id: string, offsetY = 75) => {
    const node = nodes.find((n) => n.id === id);
    if (!node) return { x: 0, y: 0 };
    return {
      x: node.x,
      y: node.y + offsetY,
    };
  };

  const createBezierPath = (start: { x: number; y: number }, end: { x: number; y: number }) => {
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Smooth curvature calculation for any distance or direction
    let controlOffset = Math.max(60, Math.min(220, Math.abs(deltaX) * 0.5 + Math.abs(deltaY) * 0.15));
    if (deltaX < 0) {
      controlOffset = Math.max(120, Math.min(300, distance * 0.45));
    }

    const c1x = start.x + controlOffset;
    const c1y = start.y;
    const c2x = end.x - controlOffset;
    const c2y = end.y;

    return `M ${start.x} ${start.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${end.x} ${end.y}`;
  };

  // Compute socket handle locations
  const hInputOutTop = getOutputHandle('input-trigger', 50);
  const hInputOutBottom = getOutputHandle('input-trigger', 100);

  const hChatGPTIn = getInputHandle('ai-chatgpt', 75);
  const hChatGPTOut = getOutputHandle('ai-chatgpt', 75);

  const hGeminiIn = getInputHandle('ai-gemini', 75);
  const hGeminiOut = getOutputHandle('ai-gemini', 75);

  const hContentIn = getInputHandle('content-path', 75);
  const hContentOut = getOutputHandle('content-path', 75);

  const hImageIn = getInputHandle('image-path', 75);
  const hImageOut = getOutputHandle('image-path', 75);

  const hOutputInTop = getInputHandle('output-publish', 50);
  const hOutputInBottom = getInputHandle('output-publish', 100);

  // Trigger wires
  const pathTriggerToChatGPT = createBezierPath(hInputOutTop, hChatGPTIn);
  const pathTriggerToGemini = createBezierPath(hInputOutBottom, hGeminiIn);

  // Dynamic AI Rerouting Wires:
  const pathContentAIWire =
    activeContentAIProvider === 'gemini'
      ? createBezierPath(hGeminiOut, hContentIn)
      : activeContentAIProvider === 'chatgpt'
      ? createBezierPath(hChatGPTOut, hContentIn)
      : createBezierPath(hGeminiOut, hContentIn);

  const pathImageAIWire =
    activeImageAIProvider === 'chatgpt'
      ? createBezierPath(hChatGPTOut, hImageIn)
      : activeImageAIProvider === 'gemini'
      ? createBezierPath(hGeminiOut, hImageIn)
      : createBezierPath(hChatGPTOut, hImageIn);

  // Output destination wires
  const pathContentToOutput = createBezierPath(hContentOut, hOutputInBottom);
  const pathImageToOutput = createBezierPath(hImageOut, hOutputInTop);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '1280px', margin: '0 auto', boxSizing: 'border-box' }}>
      {/* Dynamic Keyframes for Glowing Particle Animations */}
      <style>{`
        @keyframes n8nFlow {
          from { stroke-dashoffset: 24; }
          to { stroke-dashoffset: 0; }
        }
      `}</style>

      {/* Top Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.375rem' }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '0.375rem', backgroundColor: 'var(--accent-primary-alpha)', color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              n8n Visual Multi-AI Workflow Engine
            </span>
            {!checkingFbStatus && (
              <span style={{ fontSize: '0.71875rem', fontWeight: 500, color: isFbConnected ? 'var(--status-success)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isFbConnected ? 'var(--status-success)' : '#F59E0B' }} />
                {isFbConnected ? 'Facebook Connected' : 'Facebook Disconnected'}
              </span>
            )}
          </div>
          <h2 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>
            Multi-AI Automation Pipeline
          </h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem', margin: '0.25rem 0 0 0' }}>
            Configure any AI model on any box (ChatGPT, Gemini, Claude, DALL-E) — auto-reroutes if any AI box is turned off.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<FiRefreshCw />}
            onClick={resetNodeLayout}
            style={{ height: '38px', padding: '0 1rem', fontSize: '0.8125rem' }}
          >
            Reset View
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<FiPlay />}
            onClick={runTestPipeline}
            disabled={isTesting}
            style={{ height: '38px', padding: '0 1.125rem', fontSize: '0.8125rem' }}
          >
            {isTesting ? 'Testing Pipeline...' : 'Run Test Pipeline'}
          </Button>
        </div>
      </div>

      {/* Test Execution Status Banner */}
      {testRunMessage && (
        <div
          style={{
            padding: '0.875rem 1.125rem',
            borderRadius: '0.625rem',
            backgroundColor: isFbConnected ? 'var(--status-info-bg)' : 'rgba(245, 158, 11, 0.1)',
            color: isFbConnected ? 'var(--status-info)' : '#F59E0B',
            fontSize: '0.8125rem',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '0.625rem',
            border: isFbConnected ? '1px solid var(--border-color)' : '1px solid rgba(245, 158, 11, 0.3)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <FiActivity style={{ fontSize: '1rem', flexShrink: 0 }} />
          <span>{testRunMessage}</span>
        </div>
      )}

      {/* n8n Interactive Visual Canvas Container */}
      <div
        ref={canvasRef}
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
                backgroundImage: 'radial-gradient(var(--text-muted) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
                userSelect: 'none',
                cursor: isPanning ? 'grabbing' : 'grab',
              }
            : {
                width: '100%',
                height: '640px',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '0.875rem',
                border: '1px solid var(--border-color)',
                position: 'relative',
                overflow: 'hidden',
                backgroundImage: 'radial-gradient(var(--border-color-hover) 1.2px, transparent 1.2px)',
                backgroundSize: '24px 24px',
                boxShadow: 'var(--shadow-sm)',
                userSelect: 'none',
                cursor: isPanning ? 'grabbing' : 'grab',
              }
        }
      >
        {/* Floating Top Control Toolbar (Zoom, Pan & Fullscreen Controls) */}
        <div
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            backgroundColor: 'var(--bg-surface)',
            backdropFilter: 'blur(8px)',
            padding: '0.375rem 0.625rem',
            borderRadius: '0.625rem',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          {/* Pan Indicator Icon */}
          <div
            title="Click & Drag Screen to Pan Canvas"
            style={{
              color: 'var(--text-muted)',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              padding: '0 0.25rem',
            }}
          >
            <FiMove />
          </div>

          {/* Recenter & Reset Layout Button */}
          <button
            type="button"
            title="Recenter Canvas & Reset Node Layout"
            onClick={resetNodeLayout}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--accent-primary)',
              fontSize: '0.875rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.25rem 0.5rem',
              borderRadius: '0.25rem',
              fontWeight: 600,
            }}
          >
            <FiCrosshair style={{ fontSize: '0.9375rem' }} />
            <span style={{ fontSize: '0.75rem' }}>Recenter</span>
          </button>

          <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--border-color)', margin: '0 0.125rem' }} />

          {/* Zoom Out Button */}
          <button
            type="button"
            title="Zoom Out (-)"
            onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.1) * 100) / 100))}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: '1rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.25rem 0.375rem',
              borderRadius: '0.25rem',
            }}
          >
            <FiZoomOut />
          </button>

          {/* Zoom Percentage Label / Reset */}
          <button
            type="button"
            title="Reset Zoom & Position"
            onClick={() => {
              setZoom(1.0);
              setPanOffset({ x: 0, y: 0 });
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--accent-primary)',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              padding: '0.25rem 0.5rem',
              fontFamily: 'monospace',
            }}
          >
            {Math.round(zoom * 100)}%
          </button>

          {/* Zoom In Button */}
          <button
            type="button"
            title="Zoom In (+)"
            onClick={() => setZoom((z) => Math.min(1.8, Math.round((z + 0.1) * 100) / 100))}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: '1rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.25rem 0.375rem',
              borderRadius: '0.25rem',
            }}
          >
            <FiZoomIn />
          </button>

          <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--border-color)', margin: '0 0.25rem' }} />

          {/* Fullscreen / Full Page Toggle Button */}
          <button
            type="button"
            title={isFullscreen ? 'Exit Fullscreen' : 'View Full Page Canvas'}
            onClick={() => setIsFullscreen(!isFullscreen)}
            style={{
              background: isFullscreen ? 'var(--accent-primary)' : 'transparent',
              border: isFullscreen ? '1px solid var(--accent-primary)' : 'none',
              color: isFullscreen ? '#FFFFFF' : 'var(--text-primary)',
              fontSize: '1rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.25rem 0.5rem',
              borderRadius: '0.25rem',
              fontWeight: 600,
            }}
          >
            {isFullscreen ? <FiMinimize2 /> : <FiMaximize2 />}
            <span style={{ fontSize: '0.75rem' }}>{isFullscreen ? 'Exit Full Screen' : 'Full Screen'}</span>
          </button>
        </div>

        {/* Canvas Left Status Info Overlay */}
        <div style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 10, pointerEvents: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--text-muted)', fontSize: '0.71875rem', backgroundColor: 'rgba(0, 0, 0, 0.65)', padding: '0.25rem 0.625rem', borderRadius: '0.375rem', backdropFilter: 'blur(4px)' }}>
            <FiInfo style={{ color: 'var(--accent-primary)' }} />
            <span>Multi-AI Configurable Engine • Custom AI Model Assignment per Box</span>
          </div>
        </div>

        {/* Pannable & Zoomable Workspace Wrapper (Infinite 6000x4000 Surface) */}
        <div
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            width: '6000px',
            height: '4000px',
            position: 'absolute',
            top: 0,
            left: 0,
            transition: isPanning || draggingNodeId ? 'none' : 'transform 0.1s cubic-bezier(0.2, 0, 0, 1)',
          }}
        >
          {/* SVG Dynamic Connection Curves / Paths */}
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '6000px',
              height: '4000px',
              pointerEvents: 'none',
              zIndex: 2,
            }}
          >
            {/* Trigger -> ChatGPT AI Box */}
            <path
              d={pathTriggerToChatGPT}
              fill="none"
              stroke={isFbConnected && isChatGPTActive ? '#10B981' : '#333333'}
              strokeWidth={isFbConnected && isChatGPTActive ? '3.5' : '2'}
              strokeDasharray={isFbConnected && isChatGPTActive ? '8 6' : '4 4'}
              style={{ animation: isFbConnected && isChatGPTActive ? 'n8nFlow 1.2s linear infinite' : 'none' }}
              opacity={isFbConnected && isChatGPTActive ? 1 : 0.3}
            />

            {/* Trigger -> Gemini AI Box */}
            <path
              d={pathTriggerToGemini}
              fill="none"
              stroke={isFbConnected && isGeminiActive ? 'var(--accent-primary)' : '#333333'}
              strokeWidth={isFbConnected && isGeminiActive ? '3.5' : '2'}
              strokeDasharray={isFbConnected && isGeminiActive ? '8 6' : '4 4'}
              style={{ animation: isFbConnected && isGeminiActive ? 'n8nFlow 1.2s linear infinite' : 'none' }}
              opacity={isFbConnected && isGeminiActive ? 1 : 0.3}
            />

            {/* Dynamic Wire for Content Generation Path */}
            <path
              d={pathContentAIWire}
              fill="none"
              stroke={
                isFbConnected && isContentPathActive && activeContentAIProvider
                  ? activeContentAIProvider === 'gemini'
                    ? 'var(--accent-primary)'
                    : '#10B981'
                  : '#333333'
              }
              strokeWidth={isFbConnected && isContentPathActive && activeContentAIProvider ? '3.5' : '2'}
              strokeDasharray={isFbConnected && isContentPathActive && activeContentAIProvider ? '8 6' : '4 4'}
              style={{ animation: isFbConnected && isContentPathActive && activeContentAIProvider ? 'n8nFlow 1.2s linear infinite' : 'none' }}
              opacity={isFbConnected && isContentPathActive && activeContentAIProvider ? 1 : 0.25}
            />

            {/* Dynamic Wire for Image Processing Path */}
            <path
              d={pathImageAIWire}
              fill="none"
              stroke={
                isFbConnected && isImagePathActive && activeImageAIProvider
                  ? activeImageAIProvider === 'chatgpt'
                    ? '#10B981'
                    : 'var(--accent-primary)'
                  : '#333333'
              }
              strokeWidth={isFbConnected && isImagePathActive && activeImageAIProvider ? '3.5' : '2'}
              strokeDasharray={isFbConnected && isImagePathActive && activeImageAIProvider ? '8 6' : '4 4'}
              style={{ animation: isFbConnected && isImagePathActive && activeImageAIProvider ? 'n8nFlow 1.2s linear infinite' : 'none' }}
              opacity={isFbConnected && isImagePathActive && activeImageAIProvider ? 1 : 0.25}
            />

            {/* Content Path -> Output Destination */}
            <path
              d={pathContentToOutput}
              fill="none"
              stroke={isFbConnected && isContentPathActive && activeContentAIProvider ? 'var(--accent-primary)' : '#333333'}
              strokeWidth={isFbConnected && isContentPathActive && activeContentAIProvider ? '3.5' : '2'}
              strokeDasharray={isFbConnected && isContentPathActive && activeContentAIProvider ? '8 6' : '4 4'}
              style={{ animation: isFbConnected && isContentPathActive && activeContentAIProvider ? 'n8nFlow 1.2s linear infinite' : 'none' }}
              opacity={isFbConnected && isContentPathActive && activeContentAIProvider ? 1 : 0.3}
            />

            {/* Image Path -> Output Destination */}
            <path
              d={pathImageToOutput}
              fill="none"
              stroke={isFbConnected && isImagePathActive && activeImageAIProvider ? '#10B981' : '#333333'}
              strokeWidth={isFbConnected && isImagePathActive && activeImageAIProvider ? '3.5' : '2'}
              strokeDasharray={isFbConnected && isImagePathActive && activeImageAIProvider ? '8 6' : '4 4'}
              style={{ animation: isFbConnected && isImagePathActive && activeImageAIProvider ? 'n8nFlow 1.2s linear infinite' : 'none' }}
              opacity={isFbConnected && isImagePathActive && activeImageAIProvider ? 1 : 0.3}
            />
          </svg>

          {/* Render Interactive Nodes */}
          {nodes.map((node) => {
            const isDragging = draggingNodeId === node.id;
            const isTrigger = node.id === 'input-trigger';
            const isBypassed = !node.enabled || (!isFbConnected && !isTrigger);

            // Compute dynamic descriptions & active model for branch nodes
            let currentDisplayModel = node.model;
            let currentDisplayDesc = node.description;

            if (node.id === 'content-path') {
              if (activeContentAIProvider === 'gemini') {
                currentDisplayModel = geminiModel;
                currentDisplayDesc = `Connected to ${geminiNodeObj?.title || 'Gemini Pro Engine'} to construct copy.`;
              } else if (activeContentAIProvider === 'chatgpt') {
                currentDisplayModel = `${chatgptModel} (auto-rerouted)`;
                currentDisplayDesc = `Auto-Rerouted: Connected to ${chatgptNodeObj?.title || 'ChatGPT Engine'} (${geminiNodeObj?.title || 'Gemini Box'} Bypassed).`;
              } else {
                currentDisplayModel = 'AI Disconnected';
                currentDisplayDesc = 'Pipeline Disconnected: No active AI Engine Provider available.';
              }
            } else if (node.id === 'image-path') {
              if (activeImageAIProvider === 'chatgpt') {
                currentDisplayModel = chatgptModel;
                currentDisplayDesc = `Connected to ${chatgptNodeObj?.title || 'ChatGPT Engine'} to process images.`;
              } else if (activeImageAIProvider === 'gemini') {
                currentDisplayModel = `${geminiModel} (auto-rerouted)`;
                currentDisplayDesc = `Auto-Rerouted: Connected to ${geminiNodeObj?.title || 'Gemini Engine'} (${chatgptNodeObj?.title || 'ChatGPT Box'} Bypassed).`;
              } else {
                currentDisplayModel = 'AI Disconnected';
                currentDisplayDesc = 'Pipeline Disconnected: No active AI Engine Provider available.';
              }
            }

            return (
              <div
                key={node.id}
                onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                style={{
                  position: 'absolute',
                  left: `${node.x}px`,
                  top: `${node.y}px`,
                  width: '260px',
                  minHeight: '150px',
                  backgroundColor: 'var(--bg-surface)',
                  border: isDragging
                    ? '2px solid var(--accent-primary)'
                    : isBypassed
                    ? '1px dashed #404040'
                    : '1px solid var(--border-color)',
                  borderRadius: '0.75rem',
                  boxShadow: isDragging
                    ? '0 14px 32px rgba(0, 0, 0, 0.7), 0 0 0 2px var(--accent-primary-alpha)'
                    : '0 8px 24px rgba(0, 0, 0, 0.5)',
                  opacity: isBypassed ? 0.6 : 1,
                  cursor: isDragging ? 'grabbing' : 'grab',
                  zIndex: isDragging ? 10 : 3,
                  boxSizing: 'border-box',
                  transition: isDragging ? 'none' : 'box-shadow 0.2s ease, opacity 0.2s ease, border-color 0.2s ease',
                }}
              >
                {/* Node Header Bar */}
                <div
                  style={{
                    padding: '0.625rem 0.875rem',
                    backgroundColor: 'var(--bg-secondary)',
                    borderBottom: '1px solid var(--border-color)',
                    borderTopLeftRadius: '0.75rem',
                    borderTopRightRadius: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                    <span style={{ fontSize: '1.125rem', display: 'flex', alignItems: 'center', flexShrink: 0 }}>{node.icon}</span>
                    <span style={{ fontSize: '0.71875rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {node.subtitle}
                    </span>
                  </div>

                  <div style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
                    {isTrigger && !isFbConnected ? (
                      <Badge variant="warning" size="sm">
                        Session Required
                      </Badge>
                    ) : (
                      <Badge variant={node.badgeVariant} size="sm">
                        {node.badgeText}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Node Main Body */}
                <div style={{ padding: '0.75rem 0.875rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {/* Node Title & AI Model Pill */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <h4 style={{ fontSize: '0.84375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap' }}>
                      {node.title}
                    </h4>
                    {currentDisplayModel && (
                      <span style={{ fontSize: '0.6875rem', color: 'var(--accent-primary)', fontWeight: 600, backgroundColor: 'var(--accent-primary-alpha)', padding: '0.125rem 0.4rem', borderRadius: '0.25rem', whiteSpace: 'nowrap', width: 'fit-content' }}>
                        {currentDisplayModel}
                      </span>
                    )}
                  </div>

                  <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.45 }}>
                    {isTrigger && !isFbConnected
                      ? 'Facebook account not logged in. Connect session in Settings to enable URL scraping.'
                      : currentDisplayDesc}
                  </p>

                  {/* Node Interactive Switch / Connect Button & Config */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                    {isTrigger && !isFbConnected ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateToFacebookLogin();
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.375rem',
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          border: 'none',
                          background: '#1877F2',
                          color: '#FFFFFF',
                          cursor: 'pointer',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '0.25rem',
                        }}
                      >
                        <FiFacebook />
                        <span>Connect Facebook</span>
                      </button>
                    ) : (node.type === 'ai' || node.type === 'content_branch' || node.type === 'image_branch') ? (
                      <button
                        type="button"
                        onClick={(e) => togglePathConnection(node.id, e)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          border: 'none',
                          background: 'transparent',
                          color: node.enabled && isFbConnected ? 'var(--text-primary)' : 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        {/* Apple-style iOS Toggle Track */}
                        <div
                          style={{
                            width: '36px',
                            height: '20px',
                            borderRadius: '10px',
                            backgroundColor: node.enabled && isFbConnected ? '#2563EB' : '#333333',
                            display: 'flex',
                            alignItems: 'center',
                            padding: '2px',
                            boxSizing: 'border-box',
                            transition: 'background-color 0.2s cubic-bezier(0.2, 0, 0, 1)',
                            flexShrink: 0,
                          }}
                        >
                          {/* Sliding White Circular Knob */}
                          <div
                            style={{
                              width: '16px',
                              height: '16px',
                              borderRadius: '50%',
                              backgroundColor: '#FFFFFF',
                              transform: node.enabled && isFbConnected ? 'translateX(16px)' : 'translateX(0px)',
                              transition: 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)',
                              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.4)',
                            }}
                          />
                        </div>
                        <span>{node.enabled ? 'Path Connected' : 'Path Disconnected'}</span>
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: isFbConnected ? 'var(--text-muted)' : '#EF4444', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: isFbConnected ? 'var(--status-success)' : '#EF4444' }} />
                        {isFbConnected ? 'Active Node' : 'Pipeline Stopped'}
                      </span>
                    )}

                    {node.type !== 'content_branch' && node.type !== 'image_branch' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedNode(node);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          fontSize: '0.6875rem',
                          color: 'var(--accent-primary)',
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          fontWeight: 600,
                          padding: 0,
                        }}
                      >
                        <FiSettings style={{ fontSize: '0.75rem' }} />
                        <span>Config</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Socket Handles */}
                {/* Left Input Handle Socket (Center Y: 75px) */}
                <div
                  style={{
                    position: 'absolute',
                    left: '-7px',
                    top: '75px',
                    transform: 'translateY(-50%)',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: isTrigger && !isFbConnected ? '#EF4444' : node.enabled && isFbConnected ? 'var(--accent-primary)' : '#404040',
                    border: '2px solid var(--bg-surface)',
                    boxShadow: isTrigger && !isFbConnected ? '0 0 8px rgba(239, 68, 68, 0.6)' : node.enabled && isFbConnected ? '0 0 8px rgba(37, 99, 235, 0.6)' : 'none',
                    zIndex: 4,
                  }}
                />

                {/* Right Output Handle Socket */}
                {node.id !== 'input-trigger' && (
                  <div
                    style={{
                      position: 'absolute',
                      right: '-7px',
                      top: '75px',
                      transform: 'translateY(-50%)',
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: isTrigger && !isFbConnected ? '#EF4444' : node.enabled && isFbConnected ? 'var(--accent-primary)' : '#404040',
                      border: '2px solid var(--bg-surface)',
                      boxShadow: isTrigger && !isFbConnected ? '0 0 8px rgba(239, 68, 68, 0.6)' : node.enabled && isFbConnected ? '0 0 8px rgba(37, 99, 235, 0.6)' : 'none',
                      zIndex: 4,
                    }}
                  />
                )}

                {/* Multi Output Socket for Trigger Node (Top: 50px, Bottom: 100px) */}
                {node.id === 'input-trigger' && (
                  <>
                    <div
                      style={{
                        position: 'absolute',
                        right: '-7px',
                        top: '50px',
                        transform: 'translateY(-50%)',
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: isFbConnected && isChatGPTActive ? '#10B981' : '#404040',
                        border: '2px solid var(--bg-surface)',
                        zIndex: 4,
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        right: '-7px',
                        top: '100px',
                        transform: 'translateY(-50%)',
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: isFbConnected && isGeminiActive ? 'var(--accent-primary)' : '#404040',
                        border: '2px solid var(--bg-surface)',
                        zIndex: 4,
                      }}
                    />
                  </>
                )}

                {/* Multi Input Sockets for Output Publish Node */}
                {node.id === 'output-publish' && (
                  <>
                    <div
                      style={{
                        position: 'absolute',
                        left: '-7px',
                        top: '50px',
                        transform: 'translateY(-50%)',
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: isFbConnected && isImagePathActive && activeImageAIProvider ? '#10B981' : '#404040',
                        border: '2px solid var(--bg-surface)',
                        zIndex: 4,
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        left: '-7px',
                        top: '100px',
                        transform: 'translateY(-50%)',
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: isFbConnected && isContentPathActive && activeContentAIProvider ? 'var(--accent-primary)' : '#404040',
                        border: '2px solid var(--bg-surface)',
                        zIndex: 4,
                      }}
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Node Settings Inspector Modal */}
      {selectedNode && (
        <Modal
          isOpen={!!selectedNode}
          onClose={() => setSelectedNode(null)}
          title={`Node Inspector: ${selectedNode.title}`}
          maxWidth="500px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem', borderRadius: '0.5rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '1.5rem' }}>{selectedNode.icon}</span>
              <div>
                <h4 style={{ fontSize: '0.90625rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  {selectedNode.title}
                </h4>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{selectedNode.subtitle}</span>
              </div>
            </div>

            {/* AI Engine Model Selection Dropdown (For AI & Branch Nodes) */}
            {(selectedNode.type === 'ai' || selectedNode.type === 'content_branch' || selectedNode.type === 'image_branch') && (
              <div>
                <CustomDropdown
                  label="Select AI Model / Provider Engine"
                  options={aiModelOptions}
                  value={selectedNode.model || 'gpt-4o'}
                  onChange={(newModel) => handleModelSelectForNode(selectedNode.id, newModel)}
                />
                <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.375rem', margin: '0.375rem 0 0 0' }}>
                  Assign specific AI model (ChatGPT, Gemini, Claude, DALL-E) to process this node path.
                </p>
              </div>
            )}

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.375rem' }}>
                Node Connection Status
              </label>
              <button
                type="button"
                onClick={() => {
                  togglePathConnection(selectedNode.id);
                  setSelectedNode({ ...selectedNode, enabled: !selectedNode.enabled });
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  width: '100%',
                  padding: '0.625rem 0.875rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                }}
              >
                {/* Apple-style iOS Toggle Track */}
                <div
                  style={{
                    width: '38px',
                    height: '22px',
                    borderRadius: '11px',
                    backgroundColor: selectedNode.enabled ? '#2563EB' : '#333333',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '2px',
                    boxSizing: 'border-box',
                    transition: 'background-color 0.2s cubic-bezier(0.2, 0, 0, 1)',
                    flexShrink: 0,
                  }}
                >
                  {/* Sliding White Circular Knob */}
                  <div
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      backgroundColor: '#FFFFFF',
                      transform: selectedNode.enabled ? 'translateX(16px)' : 'translateX(0px)',
                      transition: 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.4)',
                    }}
                  />
                </div>
                <span>{selectedNode.enabled ? 'Path Connected & Processing' : 'Path Disconnected / Bypassed'}</span>
              </button>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.375rem' }}>
                Node Description
              </label>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                {selectedNode.description}
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <Button variant="primary" size="sm" onClick={() => setSelectedNode(null)}>
                Save & Close Inspector
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
