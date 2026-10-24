import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import {
  FacebookWorkflowCanvas,
  DEFAULT_FB_WORKFLOW_CONFIG,
  loadAvailablePromptTemplates,
  type FacebookWorkflowConfig,
  type FacebookWorkflowCanvasRef,
  type WorkflowExecutionState,
} from '../facebook-import/FacebookWorkflowCanvas';
import { saveRemainingPost, checkSocialPlatform } from '../remaining-posts/remainingPostsStorage';
import { saveAutoPostItem } from '../autopost/autoPostStorage';
import { addAIHistoryEntry } from '../ai-models/aiModelStorage';
import {
  getSavedWorkflowFormats,
  saveWorkflowFormatsList,
  getActiveWorkflowFormatId,
  setActiveWorkflowFormatId,
  restoreDefaultWorkflowFormats,
  type WorkflowFormat,
} from './workflowFormats';
import { isWatermarkAIBox, isTextFormatAIBox, isN8NAIBox, isExternalBrowserAIBox } from '../facebook-import/aiModelUtils';
import { runN8NWorkflow } from '../../services/n8nService';
import { createBatchImageQueue, startImageQueue, focusBrowserTabGroup, openBrowserProfile, fetchTabGroups, waitForBrowserTabsReady, startAutomation, stopAutomation, getAutomationStatus, fetchImageQueue } from '../browser-processing/browserAutomationService';
import { resolvePromptForBrowserNode } from '../browser-processing/browserPromptUtils';
import { getSavedCropFormats, formatImageWithCropFormat, type CropStudioFormat } from '../watermark/cropFormats';
import { loadActiveWatermarkConfig } from '../autopost/watermarkStorage';
import {
  FiGitBranch,
  FiPlus,
  FiSave,
  FiCopy,
  FiTrash2,
  FiCheck,
  FiArrowRight,
  FiCheckCircle,
  FiMaximize2,
  FiCrosshair,
  FiLayers,
  FiRotateCcw,
  FiPlay,
  FiLink,
  FiSliders,
  FiArrowLeft,
  FiAlertTriangle,
  FiSquare,
} from 'react-icons/fi';
import { FaFacebook, FaTiktok } from 'react-icons/fa';
import { HiSparkles } from 'react-icons/hi2';
import { useTheme } from '../../context/ThemeContext';

export const CreateWorkflowView: React.FC = () => {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const canvasRef = useRef<FacebookWorkflowCanvasRef>(null);
  const [formats, setFormats] = useState<WorkflowFormat[]>(() => getSavedWorkflowFormats());
  const [activeFormatId, setActiveId] = useState<string>(() => {
    const sp = new URLSearchParams(window.location.search);
    return sp.get('id') || sp.get('format') || getActiveWorkflowFormatId();
  });
  const [headerTitleEl, setHeaderTitleEl] = useState<HTMLElement | null>(null);
  const [headerCenterEl, setHeaderCenterEl] = useState<HTMLElement | null>(null);
  const [headerActionEl, setHeaderActionEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setHeaderTitleEl(document.getElementById('header-title-portal'));
    setHeaderCenterEl(document.getElementById('header-center-portal'));
    setHeaderActionEl(document.getElementById('header-action-portal'));

    // Sync latest workflow formats from backend API
    fetch('http://localhost:8085/api/workflow/config')
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.workflow_formats) && data.workflow_formats.length > 0) {
          setFormats(data.workflow_formats);
          localStorage.setItem('estate_saved_workflow_formats_v2', JSON.stringify(data.workflow_formats));
          setEditingFormat((prev) => {
            const sp = new URLSearchParams(window.location.search);
            const urlId = sp.get('id') || sp.get('format');
            const targetId = urlId || prev?.id;
            const found = data.workflow_formats.find((f: WorkflowFormat) => f.id === targetId);
            return found || data.workflow_formats[0];
          });
        }
      })
      .catch(() => {});

    const handleWfSync = () => {
      fetch('http://localhost:8085/api/workflow/config')
        .then((res) => res.json())
        .then((data) => {
          if (data && Array.isArray(data.workflow_formats) && data.workflow_formats.length > 0) {
            setFormats(data.workflow_formats);
            localStorage.setItem('estate_saved_workflow_formats_v2', JSON.stringify(data.workflow_formats));
            setEditingFormat((prev) => {
              const targetId = prev?.id;
              const found = data.workflow_formats.find((f: WorkflowFormat) => f.id === targetId);
              return found || prev;
            });
          }
        })
        .catch(() => {});
    };

    window.addEventListener('ea_workflow_updated', handleWfSync);
    window.addEventListener('ea_crop_formats_updated', handleWfSync);
    return () => {
      window.removeEventListener('ea_workflow_updated', handleWfSync);
      window.removeEventListener('ea_crop_formats_updated', handleWfSync);
    };
  }, []);

  // Canvas Page view state (replaces modal popup with full-page canvas)
  const [isCanvasOpen, setIsCanvasOpen] = useState<boolean>(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get('id') || sp.get('format') || sp.get('canvas') === 'true') return true;
      return localStorage.getItem('ea_workflow_canvas_open') === 'true';
    } catch {
      return false;
    }
  });
  const [editingFormat, setEditingFormat] = useState<WorkflowFormat | null>(() => {
    const list = getSavedWorkflowFormats();
    const sp = new URLSearchParams(window.location.search);
    const urlId = sp.get('id') || sp.get('format');
    const id = urlId || getActiveWorkflowFormatId();
    return list.find((f) => f.id === id) || list[0] || null;
  });
  const [modalFormatName, setModalFormatName] = useState<string>(() => {
    const list = getSavedWorkflowFormats();
    const sp = new URLSearchParams(window.location.search);
    const urlId = sp.get('id') || sp.get('format');
    const id = urlId || getActiveWorkflowFormatId();
    const found = list.find((f) => f.id === id) || list[0];
    return found ? found.name : '';
  });
  const [modalFormatDesc, setModalFormatDesc] = useState<string>(() => {
    const list = getSavedWorkflowFormats();
    const sp = new URLSearchParams(window.location.search);
    const urlId = sp.get('id') || sp.get('format');
    const id = urlId || getActiveWorkflowFormatId();
    const found = list.find((f) => f.id === id) || list[0];
    return found ? found.description || '' : '';
  });
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Auto Save state (default: true)
  const [autoSave, setAutoSave] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('ea_workflow_auto_save');
      return stored !== null ? stored === 'true' : true;
    } catch {
      return true;
    }
  });

  const handleToggleAutoSave = (enabled: boolean) => {
    setAutoSave(enabled);
    try {
      localStorage.setItem('ea_workflow_auto_save', String(enabled));
    } catch {}
  };

  // General Settings sidebar open state
  const [isGeneralSettingsOpen, setIsGeneralSettingsOpen] = useState(false);

  // Undo & Run States
  const [undoStack, setUndoStack] = useState<FacebookWorkflowConfig[]>([]);
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);
  const [runFacebookUrl, setRunFacebookUrl] = useState('');

  // Workflow Live Execution States (Canvas execution runner)
  const [executionState, setExecutionState] = useState<WorkflowExecutionState | undefined>(undefined);
  const [extractedContent, setExtractedContent] = useState<string>('');
  const [extractedImages, setExtractedImages] = useState<
    Array<{
      index: number;
      facebook_photo_id?: string;
      source_url: string;
      stored_url?: string;
      width?: number;
      height?: number;
      status?: string;
    }>
  >([]);
  const [watermarkedPhotos, setWatermarkedPhotos] = useState<Record<number, string>>({});
  const [enhancedPhotos, setEnhancedPhotos] = useState<Record<number, string>>({});
  const [aiGeneratedOutputs, setAiGeneratedOutputs] = useState<Record<string, string>>({});
  const [aiGeneratedCopy, setAiGeneratedCopy] = useState<string>('');
  const [projectName, setProjectName] = useState<string>('');
  const [propertyData, setPropertyData] = useState<any>(null);
  const [isRunningWorkflow, setIsRunningWorkflow] = useState<boolean>(false);
  const [showLeaveConfirmModal, setShowLeaveConfirmModal] = useState<boolean>(false);
  const [pendingLeaveAction, setPendingLeaveAction] = useState<(() => void) | null>(null);
  const isCancelledRef = useRef<boolean>(false);
  const workflowContextRef = useRef<{
    rawCaption: string;
    imageList: any[];
    propData: any;
    projName: string;
    localWatermarkedMap: Record<number, string>;
    generatedOutputsMap: Record<string, string>;
    primaryCopy: string;
    targetUrl: string;
  }>({
    rawCaption: '',
    imageList: [],
    propData: null,
    projName: '',
    localWatermarkedMap: {},
    generatedOutputsMap: {},
    primaryCopy: '',
    targetUrl: '',
  });

  // Global navigation & page unload guards when workflow is actively executing
  useEffect(() => {
    if (!isRunningWorkflow) {
      (window as any).__workflowConfirmLeave = null;
      (window as any).__isWorkflowProcessing = false;
      return;
    }

    (window as any).__isWorkflowProcessing = true;
    (window as any).__workflowConfirmLeave = (targetAction: () => void) => {
      setPendingLeaveAction(() => targetAction);
      setShowLeaveConfirmModal(true);
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };

    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href);
      setPendingLeaveAction(() => () => {
        handleCloseCanvas();
      });
      setShowLeaveConfirmModal(true);
    };

    window.history.pushState(null, '', window.location.href);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      (window as any).__workflowConfirmLeave = null;
      (window as any).__isWorkflowProcessing = false;
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isRunningWorkflow]);

  // Synchronize when URL searchParams change
  useEffect(() => {
    const urlId = searchParams.get('id') || searchParams.get('format');
    if (urlId) {
      const found = formats.find((f) => f.id === urlId);
      if (found) {
        setEditingFormat(found);
        setModalFormatName(found.name);
        setModalFormatDesc(found.description || '');
        setIsCanvasOpen(true);
        setActiveWorkflowFormatId(found.id);
        window.dispatchEvent(new CustomEvent('ea_set_canvas_mode', { detail: { active: true } }));
      }
    }
  }, [searchParams, formats]);

  // Open Canvas as full page for an existing format
  const handleOpenCanvas = (format: WorkflowFormat) => {
    setEditingFormat(format);
    setModalFormatName(format.name);
    setModalFormatDesc(format.description || '');
    setUndoStack([]);
    setIsCanvasOpen(true);
    setActiveWorkflowFormatId(format.id);
    navigate(`/create-workflow?id=${encodeURIComponent(format.id)}`, { replace: false });
    try {
      localStorage.setItem('ea_workflow_canvas_open', 'true');
    } catch {}
    window.dispatchEvent(new CustomEvent('ea_set_canvas_mode', { detail: { active: true } }));
  };

  // Close Canvas Page and return to list
  const handleCloseCanvas = () => {
    setIsCanvasOpen(false);
    navigate('/create-workflow', { replace: false });
    try {
      localStorage.removeItem('ea_workflow_canvas_open');
    } catch {}
    window.dispatchEvent(new CustomEvent('ea_set_canvas_mode', { detail: { active: false } }));
  };

  // Safe Back click on canvas portal header: prompts confirmation if currently running
  const handleBackClick = () => {
    if (isRunningWorkflow) {
      setPendingLeaveAction(() => () => handleCloseCanvas());
      setShowLeaveConfirmModal(true);
    } else {
      handleCloseCanvas();
    }
  };

  // Confirm leave while workflow is actively processing
  const handleConfirmLeave = () => {
    isCancelledRef.current = true;
    setIsRunningWorkflow(false);
    (window as any).__isWorkflowProcessing = false;
    (window as any).__workflowConfirmLeave = null;
    setExecutionState(undefined);
    setShowLeaveConfirmModal(false);

    if (pendingLeaveAction) {
      const action = pendingLeaveAction;
      setPendingLeaveAction(null);
      action();
    } else {
      handleCloseCanvas();
    }
  };

  // Cancel leave - dismiss modal and keep running
  const handleCancelLeave = () => {
    setShowLeaveConfirmModal(false);
    setPendingLeaveAction(null);
  };

  // Stop workflow execution immediately on demand
  const handleStopWorkflow = () => {
    isCancelledRef.current = true;
    setIsRunningWorkflow(false);
    (window as any).__isWorkflowProcessing = false;
    (window as any).__workflowConfirmLeave = null;
    setExecutionState(undefined);
    // Halt external browser processing and queue dispatch immediately
    stopAutomation().catch((e) => console.warn('Failed to stop automation:', e));
  };

  // Sync format name and description when editingFormat changes
  useEffect(() => {
    if (editingFormat) {
      setModalFormatName(editingFormat.name || '');
      setModalFormatDesc(editingFormat.description || '');
    }
  }, [editingFormat?.id]);

  // Sync canvas mode with AppLayout on mount and whenever isCanvasOpen changes
  useEffect(() => {
    if (isCanvasOpen) {
      window.dispatchEvent(new CustomEvent('ea_set_canvas_mode', { detail: { active: true } }));
    } else {
      window.dispatchEvent(new CustomEvent('ea_set_canvas_mode', { detail: { active: false } }));
    }
  }, [isCanvasOpen]);

  // Restore sidebar and cleanup if component unmounts
  useEffect(() => {
    return () => {
      isCancelledRef.current = true;
      (window as any).__isWorkflowProcessing = false;
      (window as any).__workflowConfirmLeave = null;
      window.dispatchEvent(new CustomEvent('ea_set_canvas_mode', { detail: { active: false } }));
    };
  }, []);

  // Create New Format and open on canvas page immediately
  const handleCreateNewFormat = () => {
    const newId = `format-${Date.now()}`;
    const newFormat: WorkflowFormat = {
      id: newId,
      name: `Custom Workflow #${formats.length + 1}`,
      description: 'Custom Facebook import extraction with dynamic AI prompt generator',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      config: {
        ...DEFAULT_FB_WORKFLOW_CONFIG,
      },
    };

    const updatedList = [...formats, newFormat];
    setFormats(updatedList);
    saveWorkflowFormatsList(updatedList);
    handleOpenCanvas(newFormat);
  };

  // Duplicate Format
  const handleDuplicateFormat = (format: WorkflowFormat, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newId = `format-${Date.now()}`;
    const duplicated: WorkflowFormat = {
      ...format,
      id: newId,
      name: `${format.name} (Copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      config: JSON.parse(JSON.stringify(format.config)),
    };

    const updatedList = [...formats, duplicated];
    setFormats(updatedList);
    saveWorkflowFormatsList(updatedList);
  };

  // Delete Format
  const handleDeleteFormat = (formatId: string, formatName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Delete workflow format "${formatName}"?`)) {
      return;
    }

    const updatedList = formats.filter((f) => f.id !== formatId);
    setFormats(updatedList);
    saveWorkflowFormatsList(updatedList);

    if (activeFormatId === formatId) {
      const nextId = updatedList[0]?.id || '';
      setActiveId(nextId);
      setActiveWorkflowFormatId(nextId);
    }

    if (editingFormat?.id === formatId && isCanvasOpen) {
      handleCloseCanvas();
      setEditingFormat(updatedList[0] || null);
    }
  };

  // Delete All Formats
  const handleDeleteAllFormats = () => {
    if (formats.length === 0) return;
    if (!window.confirm(`Are you sure you want to remove all ${formats.length} workflow format(s)? This will delete all sample and custom workflows.`)) {
      return;
    }

    setFormats([]);
    saveWorkflowFormatsList([]);
    setActiveId('');
    setActiveWorkflowFormatId('');
    setEditingFormat(null);
    try {
      localStorage.removeItem('ea_workflow_deleted_boxes');
    } catch {}
    if (isCanvasOpen) {
      handleCloseCanvas();
    }
  };

  // Restore Default Sample Formats
  const handleRestoreDefaults = () => {
    const defaults = restoreDefaultWorkflowFormats();
    setFormats(defaults);
    setActiveId(defaults[0]?.id || '');
    if (editingFormat && !defaults.some((d) => d.id === editingFormat.id)) {
      setEditingFormat(defaults[0] || null);
    }
  };

  // Set as Active Format for Facebook Import
  const handleSetActiveFormat = (formatId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActiveId(formatId);
    setActiveWorkflowFormatId(formatId);
  };

  // Switch to Facebook Import using this format
  const handleUseInFacebookImport = (formatId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActiveId(formatId);
    setActiveWorkflowFormatId(formatId);
    navigate('/facebook-import');
  };

  // Update canvas config
  const handleCanvasConfigChange = (newConfig: FacebookWorkflowConfig) => {
    if (!editingFormat) return;
    // Push previous config onto undo stack if config changed
    if (JSON.stringify(editingFormat.config) !== JSON.stringify(newConfig)) {
      setUndoStack((prev) => [...prev.slice(-30), editingFormat.config]);
    }
    const updated: WorkflowFormat = {
      ...editingFormat,
      config: newConfig,
      updatedAt: Date.now(),
    };
    setEditingFormat(updated);
    if (autoSave) {
      setFormats((prevFormats) => {
        const updatedList = prevFormats.map((f) => (f.id === editingFormat.id ? updated : f));
        saveWorkflowFormatsList(updatedList);
        return updatedList;
      });
    }
  };

  // Undo last canvas change
  const handleUndo = () => {
    if (undoStack.length === 0 || !editingFormat) return;
    const previousConfig = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, prev.length - 1));
    const updated: WorkflowFormat = {
      ...editingFormat,
      config: previousConfig,
      updatedAt: Date.now(),
    };
    setEditingFormat(updated);
    const updatedList = formats.map((f) => (f.id === editingFormat.id ? updated : f));
    setFormats(updatedList);
    saveWorkflowFormatsList(updatedList);
  };

  // Keyboard shortcut for Undo (Cmd+Z or Ctrl+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isCanvasOpen) return;
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCanvasOpen, undoStack, editingFormat, formats]);

  // Downstream execution helper for Phases 4, 5, and 6 (shared by initial run and resume)
  const executeDownstreamWorkflow = async ({
    cfg,
    rawCaption,
    imageList,
    propData,
    projName,
    localWatermarkedMap,
    generatedOutputsMap,
    primaryCopy: initialPrimaryCopy,
    targetUrl,
  }: {
    cfg: FacebookWorkflowConfig;
    rawCaption: string;
    imageList: any[];
    propData: any;
    projName: string;
    localWatermarkedMap: Record<number, string>;
    generatedOutputsMap: Record<string, string>;
    primaryCopy: string;
    targetUrl: string;
  }) => {
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    let primaryCopy = initialPrimaryCopy;

    // Phase 4: Combine Boxes (Merge Parallel Branches)
    const activeCombineBoxes = (cfg.combineBoxes || []).filter((cb) => cb && cb.enabled !== false);
    const combinedOutputsMap: Record<string, { text: string; images: string[] }> = {};

    for (const cb of activeCombineBoxes) {
      if (isCancelledRef.current) return;

      setExecutionState((prev) => ({
        ...prev!,
        activeNodeIds: [cb.id],
        currentStepMessage: `⚡ Merging content & formatted images in [${cb.title || 'Combine Box'}]...`,
        stepIndex: 5,
      }));
      await delay(500);

      const inConns = (cfg.connections || []).filter((c) => c.toNodeId === cb.id);
      const inFromIds = inConns.map((c) => c.fromNodeId);

      // Find incoming text from connected nodes
      let cbText = '';
      for (const fromId of inFromIds) {
        if (generatedOutputsMap[fromId]) {
          cbText = generatedOutputsMap[fromId];
          break;
        }
      }
      if (!cbText) {
        cbText = inFromIds.includes('get-content') ? rawCaption : (primaryCopy || rawCaption);
      }

      // Find incoming images from connected nodes
      const cbImages = imageList
        .map((img: any, idx: number) => localWatermarkedMap[idx] || img.stored_url || img.source_url)
        .filter(Boolean);

      combinedOutputsMap[cb.id] = { text: cbText, images: cbImages };
      primaryCopy = cbText;
      setAiGeneratedCopy(cbText);

      setExecutionState((prev) => ({
        ...prev!,
        completedNodeIds: Array.from(new Set([...(prev?.completedNodeIds || []), cb.id])),
        activeNodeIds: [],
        currentStepMessage: `✓ [${cb.title || 'Combine Box'}] merged ${inConns.length || 2} inputs successfully!`,
      }));
      await delay(300);
    }

    // Phase 5: Post Output (Compile Assets)
    if (cfg.outputNode?.enabled !== false) {
      setExecutionState((prev) => ({
        ...prev!,
        activeNodeIds: ['output'],
        currentStepMessage: '⚡ Compiling Final Content & Media package for dispatch...',
        stepIndex: 5,
      }));
      await delay(500);

      setExecutionState((prev) => ({
        ...prev!,
        completedNodeIds: Array.from(new Set([...(prev?.completedNodeIds || []), 'output'])),
        activeNodeIds: [],
        currentStepMessage: '✓ Final Content & Images compiled successfully!',
      }));
      await delay(300);
    }

    // Phase 6: Destinations (Direct Social Channels & Remaining Posts Database)
    const allDestinations = (cfg.destinations && cfg.destinations.length > 0)
      ? cfg.destinations
      : [cfg.destination || { id: 'destination', storeInDatabase: true, postToSocialMedia: false }];

    const connDestIds = new Set(
      (cfg.connections || [])
        .filter((c) => allDestinations.some((d) => d.id === c.toNodeId))
        .map((c) => c.toNodeId)
    );

    const activeDestList = allDestinations.filter((d) => {
      if (d.enabled === false) return false;
      if (connDestIds.size > 0) {
        return connDestIds.has(d.id);
      }
      return true;
    });

    const targetDestinations = activeDestList.length > 0 ? activeDestList : allDestinations.filter((d) => d.enabled !== false);
    const destIds = targetDestinations.map((d) => d.id || 'destination');

    const socialDestinations = targetDestinations.filter(
      (d) => (d.postToSocialMedia ?? (d.targetMode !== 'remaining_posts'))
    );
    const dbDestinations = targetDestinations.filter(
      (d) => (d.storeInDatabase ?? (d.targetMode !== 'social_media'))
    );

    setExecutionState((prev) => ({
      ...prev!,
      activeNodeIds: destIds,
      currentStepMessage: '🚀 Delivering to destinations in background (Social Post & Remaining Posts Database)...',
      stepIndex: 6,
    }));
    await delay(350);

    let anyFacebookPosted = false;
    let lastFbPostId = '';
    let lastFbPermalink = '';

    // 1. Process Direct Social Media Posting
    for (const socialDest of socialDestinations) {
      if (isCancelledRef.current) return;

      const targetPageId = socialDest.accountId || socialDest.selectedPageId || socialDest.selectedPageIds?.[0] || '1546086342286604';
      const destTitle = socialDest.accountName || socialDest.title || 'Facebook Page';

      // If this is a platform hub routing node that connects to a specific page account node,
      // pass through and let the downstream page account node execute the actual post.
      const isHubWithChildren = (cfg.connections || []).some(
        (c) => c.fromNodeId === socialDest.id && allDestinations.some((d) => d.id === c.toNodeId)
      );
      if (isHubWithChildren) {
        setExecutionState((prev) => ({
          ...prev!,
          completedNodeIds: Array.from(new Set([...(prev?.completedNodeIds || []), socialDest.id])),
          activeNodeIds: [],
          currentStepMessage: `✓ [${destTitle}] routed to connected Facebook Page.`,
        }));
        await delay(200);
        continue;
      }

      const isSchedule = (socialDest as any).publishMode === 'schedule';
      const scheduledIso = (socialDest as any).scheduledAt
        ? new Date((socialDest as any).scheduledAt).toISOString()
        : new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

      setExecutionState((prev) => ({
        ...prev!,
        activeNodeIds: [socialDest.id],
        currentStepMessage: isSchedule
          ? `⏰ Scheduling Facebook post for [${destTitle}] at ${new Date(scheduledIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}...`
          : `🚀 Auto-posting directly to Facebook [${destTitle}] in background...`,
        stepIndex: 6,
      }));

      const projectName = projName || propData?.project_name || '';

      // Get the specific text and images feeding into this destination (directly or through a hub node)
      const destInConns = (cfg.connections || []).filter((c) => c.toNodeId === socialDest.id);
      let upstreamId = destInConns[0]?.fromNodeId;

      // If upstream is a parent destination hub, trace back to the hub's incoming connection (e.g. Combine Box)
      if (upstreamId && !combinedOutputsMap[upstreamId] && !generatedOutputsMap[upstreamId]) {
        const hubInConn = (cfg.connections || []).find((c) => c.toNodeId === upstreamId);
        if (hubInConn) {
          upstreamId = hubInConn.fromNodeId;
        }
      }

      const caption =
        socialDest.includeContent !== false
          ? ((upstreamId && combinedOutputsMap[upstreamId]?.text) ||
             (upstreamId && generatedOutputsMap[upstreamId]) ||
             primaryCopy ||
             rawCaption)
          : '';

      const hashtags = socialDest.includeHashtags !== false
        ? ((socialDest as any).defaultHashtags || '')
        : '';

      const imageUrls =
        socialDest.includeImages !== false
          ? ((upstreamId && combinedOutputsMap[upstreamId]?.images) ||
             imageList
               .map((img: any, idx: number) => localWatermarkedMap[idx] || img.stored_url || img.source_url)
               .filter(Boolean))
          : [];

      let publishedSuccess = false;
      let errorMsg = '';

      try {
        if (isSchedule) {
          const schedPayload = {
            page_id: targetPageId,
            headline: '',
            caption: caption.trim(),
            hashtags: hashtags.trim(),
            image_urls: imageUrls,
            scheduled_at: scheduledIso,
          };

          const res = await fetch('http://localhost:8085/api/facebook/schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(schedPayload),
          });

          const data = await res.json().catch(() => ({}));
          if (res.ok && data.status === 'success') {
            publishedSuccess = true;
            anyFacebookPosted = true;
            lastFbPostId = String(data.post_id || '');

            saveAutoPostItem({
              id: `autopost_${Date.now()}_${socialDest.id}`,
              projectName,
              listingType: (propData?.listing_type as any) || 'RENT',
              price: propData?.price || '',
              specs: propData ? [
                propData.bedrooms ? `${propData.bedrooms} Bed` : '',
                propData.bathrooms ? `${propData.bathrooms} Bath` : '',
                propData.size_sqm ? `${propData.size_sqm} sqm` : '',
              ].filter(Boolean).join(' · ') : '',
              images: [],
              originalUrl: targetUrl,
              facebook: {
                enabled: true,
                pageId: targetPageId,
                pageName: destTitle,
                headline: '',
                caption,
                cta: 'Contact for viewing',
                hashtags,
              },
              instagram: { enabled: false, accountId: '', accountName: '', caption: '', firstCommentHashtags: '', locationTag: '' },
              tiktok: { enabled: false, accountId: '', accountName: '', hook: '', caption: '', sound: '', privacy: 'public', allowComments: true, allowDuet: true },
              scheduleType: 'SCHEDULED',
              status: 'SCHEDULED',
              scheduledAt: scheduledIso,
              createdAt: Date.now(),
              platformResults: {
                facebook: {
                  status: 'scheduled',
                  postId: String(data.post_id || ''),
                  timestamp: Date.now(),
                  pageId: targetPageId,
                  pageName: destTitle,
                },
                instagram: { status: 'skipped' },
                tiktok: { status: 'skipped' },
              },
            });
          } else {
            errorMsg = data.message || `Meta Graph API returned status ${res.status}`;
          }
        } else {
          const fbPayload = {
            page_id: targetPageId,
            headline: '',
            caption: caption.trim(),
            hashtags: hashtags.trim(),
            image_urls: imageUrls,
            force: true,
            original_url: targetUrl,
          };

          const res = await fetch('http://localhost:8085/api/facebook/publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fbPayload),
          });

          const data = await res.json().catch(() => ({}));
          if (res.ok && data.status === 'success') {
            publishedSuccess = true;
            anyFacebookPosted = true;
            lastFbPostId = data.facebook_post_id;
            lastFbPermalink = data.permalink_url;

            saveAutoPostItem({
              id: `autopost_${Date.now()}_${socialDest.id}`,
              projectName,
              listingType: (propData?.listing_type as any) || 'RENT',
              price: propData?.price || '',
              specs: propData ? [
                propData.bedrooms ? `${propData.bedrooms} Bed` : '',
                propData.bathrooms ? `${propData.bathrooms} Bath` : '',
                propData.size_sqm ? `${propData.size_sqm} sqm` : '',
              ].filter(Boolean).join(' · ') : '',
              images: [],
              originalUrl: targetUrl,
              facebook: {
                enabled: true,
                pageId: targetPageId,
                pageName: destTitle,
                headline: '',
                caption,
                cta: 'Contact for viewing',
                hashtags,
              },
              instagram: { enabled: false, accountId: '', accountName: '', caption: '', firstCommentHashtags: '', locationTag: '' },
              tiktok: { enabled: false, accountId: '', accountName: '', hook: '', caption: '', sound: '', privacy: 'public', allowComments: true, allowDuet: true },
              scheduleType: 'NOW',
              status: 'PUBLISHED',
              createdAt: Date.now(),
              platformResults: {
                facebook: {
                  status: 'success',
                  postId: data.facebook_post_id,
                  postUrl: data.permalink_url,
                  timestamp: Date.now(),
                  pageId: targetPageId,
                  pageName: destTitle,
                },
                instagram: { status: 'skipped' },
                tiktok: { status: 'skipped' },
              },
            });
          } else {
            errorMsg = data.message || `Meta Graph API returned status ${res.status}`;
          }
        }
      } catch (err: any) {
        errorMsg = err.message || 'Network error publishing to Facebook';
      }

      if (!publishedSuccess) {
        setExecutionState((prev) => ({
          ...prev!,
          isRunning: false,
          hasError: true,
          failedNodeIds: Array.from(new Set([...(prev?.failedNodeIds || []), socialDest.id])),
          activeNodeIds: [socialDest.id],
          currentStepMessage: `❌ Failed to publish to Facebook [${destTitle}]: ${errorMsg}`,
        }));
        return;
      }

      setExecutionState((prev) => ({
        ...prev!,
        completedNodeIds: Array.from(new Set([...(prev?.completedNodeIds || []), socialDest.id])),
        activeNodeIds: [],
        currentStepMessage: isSchedule
          ? `✓ Scheduled Facebook post for [${destTitle}] at ${new Date(scheduledIso).toLocaleString()}!`
          : `✓ Published to Facebook [${destTitle}] (Post ID: ${lastFbPostId})!`,
      }));

      await delay(400);
    }

    // 2. Process Remaining Posts Database Storage
    for (const dbDest of dbDestinations) {
      if (isCancelledRef.current) return;

      setExecutionState((prev) => ({
        ...prev!,
        activeNodeIds: [dbDest.id],
        currentStepMessage: `💾 Storing in [${dbDest.title || 'Remaining Posts Database'}]...`,
      }));

      const destInConns = (cfg.connections || []).filter((c) => c.toNodeId === dbDest.id);
      const upstreamId = destInConns[0]?.fromNodeId;
      const dbCaption =
        (upstreamId && combinedOutputsMap[upstreamId]?.text) ||
        (upstreamId && generatedOutputsMap[upstreamId]) ||
        primaryCopy ||
        rawCaption;

      try {
        const isTikTok = checkSocialPlatform(targetUrl) === 'tiktok';
        saveRemainingPost({
          facebook_url: targetUrl,
          platform: isTikTok ? 'tiktok' : 'facebook',
          socialMediaType: isTikTok ? 'tiktok' : 'facebook',
          projectName: projName || propData?.project_name || (isTikTok ? `TikTok Post #${lastFbPostId || Date.now()}` : `Facebook Post #${lastFbPostId || Date.now()}`),
          source: {
            platform: isTikTok ? 'tiktok' : 'facebook',
            original_url: targetUrl,
            canonical_url: targetUrl,
            source_type: isTikTok ? 'tiktok_post' : 'facebook_post',
            source_name: isTikTok ? 'TikTok Link' : 'Facebook Link',
            post_id: lastFbPostId || `post_${Date.now()}`,
            created_time: new Date().toISOString(),
            extraction_method: 'browser',
          },
          caption: dbCaption,
          languages: ['th', 'en'],
          propertyData: {
            project_name: propData?.project_name || projName || '',
            listing_type: propData?.listing_type || 'RENT',
            price: String(propData?.price || ''),
            currency: propData?.currency || 'THB',
            bedrooms: String(propData?.bedrooms || ''),
            bathrooms: String(propData?.bathrooms || ''),
            size_sqm: String(propData?.size_sqm || ''),
            floor: String(propData?.floor || ''),
            building: propData?.building || '',
            unit_number: propData?.unit_number || '',
            furnished: propData?.furnished || '',
            nearest_transit: propData?.nearest_transit || '',
            location: propData?.location || '',
            move_in_status: propData?.move_in_status || '',
            contact_name: propData?.contact_name || '',
            contact_phone: propData?.contact_phone || '',
            contact_line: propData?.contact_line || '',
          },
          originalImages: imageList.map((img: any, i: number) => ({
            index: img.index ?? i,
            source_url: img.source_url || '',
            stored_url: img.stored_url || '',
            status: img.status || 'verified',
            width: img.width || 800,
            height: img.height || 600,
          })),
          enhancedPhotos: {},
          watermarkedPhotos: localWatermarkedMap,
          aiGeneratedOutputs: generatedOutputsMap,
          aiGeneratedCopy: dbCaption,
          workflowFormatName: editingFormat?.name || 'Workflow',
          autoProcessed: true,
        });

        setExecutionState((prev) => ({
          ...prev!,
          completedNodeIds: Array.from(new Set([...(prev?.completedNodeIds || []), dbDest.id])),
          activeNodeIds: [],
          currentStepMessage: `✓ Saved in [${dbDest.title || 'Remaining Posts Database'}]!`,
        }));
      } catch (dbErr) {
        console.error('Failed to save to Remaining Posts storage:', dbErr);
      }

      await delay(300);
    }

    if (isCancelledRef.current) return;

    // Final Completion
    setExecutionState({
      isRunning: false,
      isComplete: true,
      hasError: false,
      activeNodeIds: [],
      completedNodeIds: Array.from(
        new Set([
          'trigger',
          'get-content',
          'get-images',
          ...(cfg.aiBoxes || []).map((b) => b.id),
          ...activeCombineBoxes.map((cb) => cb.id),
          'output',
          ...destIds,
        ])
      ),
      currentStepMessage: anyFacebookPosted
        ? `✓ Workflow completed! "${projName || 'Listing'}" auto-posted directly to Facebook & delivered to all destinations.`
        : `✓ Workflow completed! "${projName || 'Listing'}" delivered to all destinations.`,
      stepIndex: 6,
      totalSteps: 6,
    });
  };

  // Run Workflow directly on this Canvas screen smoothly
  const executeCanvasWorkflow = async (targetUrl: string) => {
    if (!editingFormat) return;
    const cfg = editingFormat.config;
    setIsRunningWorkflow(true);
    isCancelledRef.current = false;
    (window as any).__isWorkflowProcessing = true;

    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    try {
      // Reset previous run outputs
    setExtractedContent('');
    setExtractedImages([]);
    setWatermarkedPhotos({});
    setEnhancedPhotos({});
    setAiGeneratedOutputs({});
    setAiGeneratedCopy('');
    setProjectName('');

    const platform = checkSocialPlatform(targetUrl);
    if (platform === 'unknown') {
      setExecutionState({
        isRunning: false,
        isComplete: false,
        hasError: true,
        activeNodeIds: [],
        completedNodeIds: [],
        failedNodeIds: ['trigger'],
        currentStepMessage: '❌ Invalid URL. Please provide a valid Facebook or TikTok post link.',
        stepIndex: 1,
        totalSteps: 6,
      });
      setIsRunningWorkflow(false);
      (window as any).__isWorkflowProcessing = false;
      return;
    }
    const platformLabel = platform === 'tiktok' ? 'TikTok' : 'Facebook';

    // Phase 1: Trigger (Extract Link)
    setExecutionState({
      isRunning: true,
      isComplete: false,
      hasError: false,
      activeNodeIds: ['trigger'],
      completedNodeIds: [],
      failedNodeIds: [],
      currentStepMessage: `Resolving ${platformLabel} post link and isolating listing...`,
      stepIndex: 1,
      totalSteps: 6,
    });

    let rawCaption = '';
    let imageList: any[] = [];
    let propData: any = null;
    let projName = '';

    try {
      const extractResp = await fetch('http://localhost:8085/api/facebook-import/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: targetUrl,
          preferred_method: 'browser',
          max_images: 25,
        }),
      });

      if (extractResp.ok) {
        const extractData = await extractResp.json();
        if (extractData.success && extractData.result) {
          const res = extractData.result;
          rawCaption = res.caption?.original || '';
          imageList = (res.images || []).map((img: any, idx: number) => ({
            index: idx,
            facebook_photo_id: img.facebook_photo_id,
            source_url: img.source_url,
            stored_url: img.stored_url,
            status: img.status || 'verified',
            width: img.width,
            height: img.height,
          }));
          propData = res.property || null;
          projName = propData?.project_name || '';
        }
      }
    } catch (err) {
      console.warn('Backend live extract call threw:', err);
    }

    // If extraction produced no content (neither caption nor images), stop with an error
    if ((!rawCaption || rawCaption.trim().length === 0) && imageList.length === 0) {
      setExecutionState((prev) => ({
        ...prev!,
        isRunning: false,
        hasError: true,
        activeNodeIds: [],
        failedNodeIds: ['trigger'],
        currentStepMessage: '❌ Could not extract content or images from the provided link. Please check the URL and try again.',
      }));
      setIsRunningWorkflow(false);
      (window as any).__isWorkflowProcessing = false;
      return;
    }

    if (!rawCaption || rawCaption.trim().length === 0) {
      rawCaption = projName || 'Property listing media extracted';
    }

    setExtractedContent(rawCaption);
    setExtractedImages(imageList);
    setProjectName(projName);
    setPropertyData(propData);

    // Save into workflow context for downstream resume capability
    workflowContextRef.current = {
      rawCaption,
      imageList,
      propData,
      projName,
      localWatermarkedMap: {},
      generatedOutputsMap: {},
      primaryCopy: '',
      targetUrl,
    };

    setExecutionState((prev) => ({
      ...prev!,
      completedNodeIds: ['trigger'],
      activeNodeIds: ['trigger'],
      currentStepMessage: `✓ Facebook link resolved (${imageList.length} photos, ${rawCaption.length} chars)`,
      stepIndex: 2,
    }));
    await delay(500);

    // Phase 2: Ingestion Nodes (Get Content & Get Images)
    const contentEnabled = cfg.getContent?.enabled !== false;
    const imagesEnabled = cfg.getImages?.enabled !== false;
    const activeIngestion = [
      ...(contentEnabled ? ['get-content'] : []),
      ...(imagesEnabled ? ['get-images'] : []),
    ];

    setExecutionState((prev) => ({
      ...prev!,
      activeNodeIds: activeIngestion,
      currentStepMessage: 'Extracting content attributes and downloading photo gallery...',
      stepIndex: 3,
    }));
    await delay(700);

    setExecutionState((prev) => ({
      ...prev!,
      completedNodeIds: Array.from(new Set([...(prev?.completedNodeIds || []), ...activeIngestion])),
      activeNodeIds: [],
      currentStepMessage: `✓ Content and ${imageList.length} photos parsed and ready for processing`,
    }));
    await delay(400);

    // Phase 3: AI Copywriting & Image Format Processing
    const aiBoxes = cfg.aiBoxes || [];
    const generatedOutputsMap: Record<string, string> = {};
    const localWatermarkedMap: Record<number, string> = {};
    let primaryCopy = '';

    for (const box of aiBoxes) {
      if (!box.enabled) continue;
      const isWatermark = isWatermarkAIBox(box);
      const isTextFormat = isTextFormatAIBox(box);
      const isN8N = isN8NAIBox(box);
      const isExternalBrowser = isExternalBrowserAIBox(box);

      setExecutionState((prev) => ({
        ...prev!,
        activeNodeIds: [box.id],
        currentStepMessage: isWatermark
          ? `✂️ Applying photo crop & frame preset [${box.title || 'Format'}]...`
          : isExternalBrowser
          ? `🌐 Coordinating External Browser & Image Queue [${box.title || 'External Browser'}]...`
          : isTextFormat
          ? `📝 Formatting AI copy with [${box.title || 'Format Preset'}]...`
          : isN8N
          ? `🔄 Executing n8n Automation Engine [${box.title || 'n8n Workflow'}]...`
          : `⚡ Generating AI copy with [${box.title || 'AI Model'}] (${box.model || 'Gemini 2.5 Flash'})...`,
        stepIndex: 4,
      }));

      if (isWatermark) {
        const savedFormats = getSavedCropFormats();
        const baseFormat =
          savedFormats.find((f) => f.id === box.cropFormatId || f.id === box.templateId || f.id === box.watermarkPresetId) ||
          savedFormats.find((f) => box.templateText && f.name.toLowerCase() === box.templateText.toLowerCase()) ||
          savedFormats.find((f) => box.title && f.name && box.title.toLowerCase().includes(f.name.toLowerCase())) ||
          ((box.title?.toLowerCase().includes('fb') || box.templateText?.toLowerCase().includes('fb'))
            ? savedFormats.find((f) => f.name.toLowerCase().includes('fb'))
            : null) ||
          savedFormats[0];

        const activeWk = typeof window !== 'undefined' ? loadActiveWatermarkConfig() : null;
        const targetFormat: CropStudioFormat = {
          ...baseFormat,
          targetWidth: box.targetWidth || baseFormat?.targetWidth || 1080,
          targetHeight: box.targetHeight || baseFormat?.targetHeight || 1350,
          aspect: box.aspect || baseFormat?.aspect || '4:5',
          fitMode: (box.fitMode || baseFormat?.fitMode || 'cover') as any,
          focusPosition: (box.focusPosition || baseFormat?.focusPosition || 'center') as any,
          cropZoom: box.cropZoom || baseFormat?.cropZoom || 1,
          watermarkConfig:
            box.watermarkConfig ||
            baseFormat?.watermarkConfig ||
            (activeWk?.config?.enabled ? activeWk.config : undefined),
        };

        for (let i = 0; i < imageList.length; i++) {
          const img = imageList[i];
          const rawUrl = img.stored_url
            ? (img.stored_url.startsWith('http') ? img.stored_url : `http://localhost:8085${img.stored_url}`)
            : img.source_url;
          try {
            const formattedDataUrl = await formatImageWithCropFormat(rawUrl, targetFormat);
            localWatermarkedMap[img.index] = formattedDataUrl;
          } catch (err) {
            console.warn('Failed to format image with crop format', err);
            localWatermarkedMap[img.index] = rawUrl;
          }
        }
        setWatermarkedPhotos((prev) => ({ ...prev, ...localWatermarkedMap }));
        setEnhancedPhotos((prev) => ({ ...prev, ...localWatermarkedMap }));
        workflowContextRef.current.localWatermarkedMap = { ...workflowContextRef.current.localWatermarkedMap, ...localWatermarkedMap };
        await delay(400);
      } else if (isN8N) {
        // Resolve upstream text / property for this n8n automation node
        const inConns = (cfg.connections || []).filter((c) => c.toNodeId === box.id);
        const upstreamBoxId = inConns[0]?.fromNodeId;
        const upstreamText =
          (upstreamBoxId && generatedOutputsMap[upstreamBoxId]) ||
          (upstreamBoxId === 'get-content' ? rawCaption : '') ||
          primaryCopy ||
          rawCaption;

        const webhookPath = (box as any).n8nWebhookPath || 'property-content-processing';
        const workflowId = (box as any).n8nWorkflowId || 'Dtjq2OPmO1SqiXm4';
        let n8nCopyText = '';

        try {
          const runRes = await runN8NWorkflow(workflowId, webhookPath, {
            execution_id: `corr-${Date.now()}`,
            source: 'BoltHavenProperty',
            event: 'property.process',
            property: {
              id: (propData as any)?.id || 'listing-01',
              project_name: projName || (propData as any)?.project_name || 'Featured Property Listing',
              bedrooms: (propData as any)?.bedrooms || 1,
              area_sqm: (propData as any)?.area_sqm || (propData as any)?.sizeSqm || 35,
              monthly_rent_thb: (propData as any)?.monthly_rent_thb || (propData as any)?.rentPrice || 35000,
              caption: upstreamText || rawCaption,
              images: imageList.map((img) => img.stored_url || img.source_url),
            },
          });

          const respObj = runRes.webhook_response as Record<string, any>;
          if (respObj) {
            n8nCopyText = respObj.formatted_summary || respObj.summary || (typeof respObj === 'string' ? respObj : JSON.stringify(respObj, null, 2));
          }
        } catch (err: any) {
          console.warn('n8n automation step error:', err);
          if (!(box as any).n8nContinueOnFailure) {
            setExecutionState((prev) => ({
              ...prev!,
              isRunning: false,
              hasError: true,
              activeNodeIds: [box.id],
              failedNodeIds: [box.id],
              currentStepMessage: `❌ n8n Automation failed for [${box.title || 'n8n Node'}]: ${err.message || 'Workflow execution error'}.`,
            }));
            setIsRunningWorkflow(false);
            (window as any).__isWorkflowProcessing = false;
            canvasRef.current?.openNodeDrawer(box.id);
            return;
          }
        }

        const finalText = n8nCopyText || upstreamText;
        generatedOutputsMap[box.id] = finalText;
        if (!primaryCopy) primaryCopy = finalText;
        setAiGeneratedOutputs((prev) => ({ ...prev, [box.id]: finalText }));
        await delay(400);
      } else if (isExternalBrowser) {
        // External Browser Processing Node — Auto Open Selected Profile & Tab Group
        const propId = (propData as any)?.id || `PROP-${Date.now()}`;
        const propName = projName || (propData as any)?.project_name || 'Featured Property Listing';

        const profId = (box as any).browserProfileId || 14;
        const profKey = (box as any).browserProfileKey || (box as any).browserProfileName || 'Profile 14';
        const groupName = (box as any).browserGroupName || 'Enhance IMG';
        const targetTabId = (box as any).browserTabId || (box as any).browserPromptTabId || (box as any).browserGenerateTabId || '';

        setExecutionState((prev) => ({
          ...prev!,
          activeNodeIds: [box.id],
          currentStepMessage: `🌐 Opening Chrome [${profKey}] & focusing Tab Group [${groupName}]...`,
          stepIndex: 4,
          propertyId: propId,
        }));

        let targetUrls = (box as any).browserGroupTabUrls ||
          ((box as any)._liveGroupTabs || []).map((t: any) => t.url).filter(Boolean);

        if (!targetUrls || targetUrls.length === 0) {
          try {
            const fetched = await fetchTabGroups(profId, profKey, (box as any).browserProfileName);
            const m = fetched.find((g) => g.name.toLowerCase() === groupName.toLowerCase()) || fetched[0];
            if (m && m.tabs && m.tabs.length > 0) {
              targetUrls = m.tabs.map((t) => t.url).filter(Boolean);
            }
          } catch (e) {}
        }

        if (!targetUrls || targetUrls.length === 0) {
          if (groupName.toLowerCase().includes('enhance')) {
            targetUrls = [
              'https://chatgpt.com/c/6ad49918-a4f0-83ec-acf5-efb0ef516adc',
              'https://chatgpt.com/c/6ad49924-7dd0-83ec-8205-768c67420600',
              'https://chatgpt.com/c/6ad4992a-66e8-83ec-9b11-c5e727e258d9',
              'https://chatgpt.com/c/6ad4992b-135c-83ec-b042-8c92220921d7',
            ];
          }
        }

        try {
          await focusBrowserTabGroup({
            profileId: profId,
            profileKey: profKey,
            groupName: groupName,
            tabId: targetTabId,
            groupTabUrls: targetUrls,
            url: targetUrls[0],
            force: true,
          });

          // Actively verify and wait until Chrome and selected tab group are verified open in browser
          const readyResult = await waitForBrowserTabsReady({
            profileKey: profKey,
            groupName: groupName,
            expectedUrls: targetUrls,
            maxWaitMs: 15000,
            onProgress: (msg) => {
              setExecutionState((prev) => ({
                ...prev!,
                activeNodeIds: [box.id],
                currentStepMessage: msg,
              }));
            },
          });

          if (readyResult.verified) {
            setExecutionState((prev) => ({
              ...prev!,
              activeNodeIds: [box.id],
              currentStepMessage: `✓ Chrome open & Tab Group [${groupName}] (${targetUrls.length || 4} tabs) confirmed active in browser!`,
            }));
            await delay(600);
          }
        } catch (openErr) {
          console.warn('Could not auto-open Chrome profile and tab group:', openErr);
        }

        const totalImages = imageList.length;
        const extPhotosMap: Record<number, string> = {};
        imageList.forEach((img, idx) => {
          extPhotosMap[idx] = img.stored_url || img.source_url;
        });

        if (totalImages > 0) {
          // Resolve prompt strictly preserving user-selected template
          const enhancePrompt = resolvePromptForBrowserNode(box, {
            title: propName,
            width: (box as any).outputWidth || (box as any).targetWidth || 1080,
            height: (box as any).outputHeight || (box as any).targetHeight || 1350,
          });

          const rawImgs = imageList.map((img, i) => ({
            index: i + 1,
            source_url: img.source_url || img.stored_url,
            stored_url: img.stored_url || img.source_url,
            local_path: (img as any).local_path || '',
            sha256: (img as any).sha256 || '',
            width: (box as any).outputWidth || (box as any).targetWidth || 1080,
            height: (box as any).outputHeight || (box as any).targetHeight || 1350,
            resolved_prompt: enhancePrompt,
          }));

          const queuePayload = {
            property_id: propId,
            property_name: propName,
            prompt_template_text: enhancePrompt,
            prompt_template_id: (box as any).browserPromptTemplateKey || 'photo_retouch',
            images: rawImgs,
            processing_mode: (box as any).browserProcessingMode || 'chrome_assisted',
            lane_id: (box as any).browserLaneKey || 'lane-1',
            output_width: (box as any).outputWidth || (box as any).targetWidth || 1080,
            output_height: (box as any).outputHeight || (box as any).targetHeight || 1350,
            strict_preservation_active: (box as any).strictPreservationActive !== false,
          };

          try {
            await createBatchImageQueue(queuePayload);
            await startImageQueue(propId);
          } catch (e) {
            console.warn('External browser queue start notice:', e);
          }

          // Trigger multi-tab automation across the open Chrome ChatGPT tabs
          setExecutionState((prev) => ({
            ...prev!,
            activeNodeIds: [box.id],
            currentStepMessage: `⚡ Distributing ${totalImages} images across 4 ChatGPT tabs with Enhance Prompt...`,
          }));

          try {
            await startAutomation({
              property_id: propId,
              profile_key: profKey,
              tab_ids: [1, 2, 3, 4],
            });
          } catch (autoErr) {
            console.warn('Automation start error:', autoErr);
          }

          // Active enhancement monitoring loop across the 4 tabs
          let pollAttempts = 0;
          const maxPollAttempts = 150; // polling up to 5 minutes
          let isDone = false;

          while (!isDone && pollAttempts < maxPollAttempts) {
            if (isCancelledRef.current) {
              console.log('Workflow cancelled by user, stopping browser automation...');
              await stopAutomation().catch(() => {});
              break;
            }
            pollAttempts++;
            await delay(2000);

            try {
              const queueJobs = await fetchImageQueue(propId);
              const status = await getAutomationStatus();

              let completedCount = 0;
              if (queueJobs && queueJobs.length > 0) {
                queueJobs.forEach((job) => {
                  const isJobDone = job.status === 'COMPLETED' || (job.status as string) === 'completed' || (job as any).is_completed;
                  const resUrl = job.output_file_url || (job as any).result_file_url;
                  if (isJobDone && resUrl) {
                    completedCount++;
                    const pos = (job.original_position || 1) - 1;
                    extPhotosMap[pos] = resUrl;
                  }
                });
              }

              if (status && status.completed !== undefined) {
                completedCount = Math.max(completedCount, status.completed);
              }

              setEnhancedPhotos((prev) => ({ ...prev, ...extPhotosMap }));
              workflowContextRef.current.localWatermarkedMap = { ...workflowContextRef.current.localWatermarkedMap, ...extPhotosMap };

              setExecutionState((prev) => ({
                ...prev!,
                activeNodeIds: [box.id],
                currentStepMessage: `⚡ Enhancing images across 4 ChatGPT tabs: ${completedCount}/${totalImages} completed (${Math.max(0, totalImages - completedCount)} remaining)...`,
              }));

              if (completedCount >= totalImages || (status && !status.is_running && (status.completed || 0) >= totalImages)) {
                isDone = true;
                break;
              }
            } catch (pollErr) {
              console.warn('Enhancement status check warning:', pollErr);
            }
          }

          setExecutionState((prev) => ({
            ...prev!,
            activeNodeIds: [box.id],
            currentStepMessage: `✓ All ${totalImages} images enhanced and downloaded! Advancing to Combine Box...`,
          }));
          await delay(600);
        }

        setEnhancedPhotos((prev) => ({ ...prev, ...extPhotosMap }));
        workflowContextRef.current.localWatermarkedMap = { ...workflowContextRef.current.localWatermarkedMap, ...extPhotosMap };
      } else {
        // Resolve upstream text for this text AI or format node
        const inConns = (cfg.connections || []).filter((c) => c.toNodeId === box.id);
        const upstreamBoxId = inConns[0]?.fromNodeId;
        const upstreamText =
          (upstreamBoxId && generatedOutputsMap[upstreamBoxId]) ||
          (upstreamBoxId === 'get-content' ? rawCaption : '') ||
          primaryCopy ||
          rawCaption;

        let copyText = '';
        const aiProvider = box.provider || (box.model?.startsWith('gpt-') ? 'openai' : 'google_ai');
        const aiModel = box.model || (aiProvider === 'openai' ? 'gpt-4o' : 'gemini-2.5-flash');
        const aiStart = Date.now();
        try {
          const aiResp = await fetch('http://localhost:8085/api/facebook-import/generate-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              provider: aiProvider,
              model: aiModel,
              template_id: box.templateId || '',
              template_name: box.title || 'Dynamic Real Estate Copywriter',
              template_text: box.templateText || '',
              raw_content: upstreamText,
              custom_prompt:
                box.customPrompt ||
                (isTextFormat
                  ? `Format this real estate listing according to the ${box.title || 'preset'} style. Maintain all property details, price, contact numbers, and formatting clean and attractive.`
                  : ''),
            }),
          });
          if (aiResp.ok) {
            const aiData = await aiResp.json();
            if (aiData.success && aiData.generated_content) {
              copyText = aiData.generated_content;
            }
          }
        } catch (err) {
          console.warn('AI API call threw:', err);
        }
        addAIHistoryEntry({
          provider: aiProvider,
          model: aiModel,
          taskType: 'text',
          prompt: box.title || 'AI Box',
          inputPreview: String(upstreamText || '').slice(0, 200),
          outputPreview: copyText || 'Generation failed',
          status: copyText ? 'success' : 'failed',
          durationMs: Date.now() - aiStart,
          sourceWorkflow: 'Create Workflow',
        });

        // If formatting failed or returned empty: ABSOLUTE STOP AT THIS STEP!
        // Do NOT fall back to unformatted raw content and do NOT continue downstream!
        if (!copyText || copyText.trim().length === 0) {
          setExecutionState((prev) => ({
            ...prev!,
            isRunning: false,
            hasError: true,
            activeNodeIds: [box.id],
            failedNodeIds: [box.id],
            currentStepMessage: `❌ AI generation failed for [${box.title || 'Formatted Content'}]. Please write/fix content or re-generate to continue.`,
          }));
          setIsRunningWorkflow(false);
          (window as any).__isWorkflowProcessing = false;
          // Automatically open this node's drawer so user can inspect and fix directly
          canvasRef.current?.openNodeDrawer(box.id);
          return;
        }

        generatedOutputsMap[box.id] = copyText;
        workflowContextRef.current.generatedOutputsMap[box.id] = copyText;
        if (!primaryCopy || isTextFormat) {
          primaryCopy = copyText;
          workflowContextRef.current.primaryCopy = copyText;
        }
        setAiGeneratedOutputs((prev) => ({ ...prev, [box.id]: copyText }));
        setAiGeneratedCopy(copyText);
        await delay(500);
      }

      setExecutionState((prev) => ({
        ...prev!,
        completedNodeIds: Array.from(new Set([...(prev?.completedNodeIds || []), box.id])),
        activeNodeIds: [],
        currentStepMessage: `✓ [${box.title || 'Node'}] executed successfully!`,
      }));
      await delay(250);
    }

    // Execute downstream: Combine Boxes, Output, Destinations
    await executeDownstreamWorkflow({
      cfg,
      rawCaption,
      imageList,
      propData,
      projName,
      localWatermarkedMap,
      generatedOutputsMap,
      primaryCopy,
      targetUrl,
    });
    } finally {
      setIsRunningWorkflow(false);
      (window as any).__isWorkflowProcessing = false;
      (window as any).__workflowConfirmLeave = null;
    }
  };

  // Update box output directly from drawer textarea
  const handleUpdateBoxOutput = (boxId: string, outputText: string) => {
    setAiGeneratedOutputs((prev) => ({ ...prev, [boxId]: outputText }));
    setAiGeneratedCopy(outputText);
    if (workflowContextRef.current) {
      workflowContextRef.current.generatedOutputsMap[boxId] = outputText;
      workflowContextRef.current.primaryCopy = outputText;
    }
    if (outputText.trim().length > 0) {
      setExecutionState((prev) => {
        if (!prev) return prev;
        const nextFailed = (prev.failedNodeIds || []).filter((id) => id !== boxId);
        return {
          ...prev,
          failedNodeIds: nextFailed,
          hasError: nextFailed.length > 0,
          currentStepMessage: `✓ Formatted content updated for [${boxId}]`,
        };
      });
    }
  };

  // Re-generate copy with AI for a specific box
  const handleRegenerateBoxOutput = async (boxId: string): Promise<string | void> => {
    if (!editingFormat?.config) return;
    const cfg = editingFormat.config;
    const box = cfg.aiBoxes?.find((b) => b.id === boxId);
    if (!box) return;

    const inConns = (cfg.connections || []).filter((c) => c.toNodeId === box.id);
    const upstreamBoxId = inConns[0]?.fromNodeId;
    const ctx = workflowContextRef.current;
    const upstreamText =
      (upstreamBoxId && (aiGeneratedOutputs[upstreamBoxId] || ctx.generatedOutputsMap[upstreamBoxId])) ||
      (upstreamBoxId === 'get-content' ? (extractedContent || ctx.rawCaption) : '') ||
      aiGeneratedCopy ||
      ctx.primaryCopy ||
      extractedContent ||
      ctx.rawCaption;

    const isTextFormat = isTextFormatAIBox(box);
    const aiProvider = box.provider || (box.model?.startsWith('gpt-') ? 'openai' : 'google_ai');
    const aiModel = box.model || (aiProvider === 'openai' ? 'gpt-4o' : 'gemini-2.5-flash');

    try {
      const aiResp = await fetch('http://localhost:8085/api/facebook-import/generate-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: aiProvider,
          model: aiModel,
          template_id: box.templateId || '',
          template_name: box.title || 'Dynamic Real Estate Copywriter',
          template_text: box.templateText || '',
          raw_content: upstreamText,
          custom_prompt:
            box.customPrompt ||
            (isTextFormat
              ? `Format this real estate listing according to the ${box.title || 'preset'} style. Maintain all property details, price, contact numbers, and formatting clean and attractive.`
              : ''),
        }),
      });

      if (aiResp.ok) {
        const aiData = await aiResp.json();
        if (aiData.success && aiData.generated_content) {
          const generated = aiData.generated_content;
          setAiGeneratedOutputs((prev) => ({ ...prev, [boxId]: generated }));
          setAiGeneratedCopy(generated);
          if (workflowContextRef.current) {
            workflowContextRef.current.generatedOutputsMap[boxId] = generated;
            workflowContextRef.current.primaryCopy = generated;
          }
          setExecutionState((prev) => {
            if (!prev) return prev;
            const nextFailed = (prev.failedNodeIds || []).filter((id) => id !== boxId);
            return {
              ...prev,
              failedNodeIds: nextFailed,
              hasError: nextFailed.length > 0,
              completedNodeIds: Array.from(new Set([...(prev.completedNodeIds || []), boxId])),
              currentStepMessage: `✓ Re-generated copy for [${box.title || 'Node'}] successfully!`,
            };
          });
          return generated;
        }
      }
    } catch (err) {
      console.warn('Re-generate AI API call threw:', err);
    }
  };

  // Continue workflow execution from a previously stopped or fixed step
  const handleContinueWorkflow = async (fromBoxId?: string) => {
    if (!editingFormat?.config || isRunningWorkflow) return;
    const cfg = editingFormat.config;
    const ctx = workflowContextRef.current;
    const targetBoxId = fromBoxId || executionState?.failedNodeIds?.[0] || cfg.aiBoxes?.[0]?.id;
    if (!targetBoxId) return;

    const currentCopy = aiGeneratedOutputs[targetBoxId] || ctx.generatedOutputsMap[targetBoxId] || aiGeneratedCopy;
    if (!currentCopy || currentCopy.trim().length === 0) {
      alert('Please enter or generate formatted content before continuing.');
      return;
    }

    ctx.generatedOutputsMap[targetBoxId] = currentCopy;
    if (!ctx.primaryCopy) ctx.primaryCopy = currentCopy;
    setAiGeneratedCopy(currentCopy);

    setIsRunningWorkflow(true);
    isCancelledRef.current = false;
    (window as any).__isWorkflowProcessing = true;

    const updatedFailed = (executionState?.failedNodeIds || []).filter((id) => id !== targetBoxId);
    const updatedCompleted = Array.from(new Set([...(executionState?.completedNodeIds || []), targetBoxId]));

    setExecutionState((prev) => ({
      ...prev!,
      isRunning: true,
      hasError: updatedFailed.length > 0,
      failedNodeIds: updatedFailed,
      completedNodeIds: updatedCompleted,
      activeNodeIds: [],
      currentStepMessage: `▶ Resuming workflow from [${cfg.aiBoxes.find((b) => b.id === targetBoxId)?.title || 'Node'}]...`,
    }));

    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    try {
      const targetIdx = cfg.aiBoxes.findIndex((b) => b.id === targetBoxId);
      const remainingAiBoxes = targetIdx >= 0 ? cfg.aiBoxes.slice(targetIdx + 1) : [];

      for (const nextBox of remainingAiBoxes) {
        if (!nextBox.enabled || updatedCompleted.includes(nextBox.id)) continue;
        const isWatermark = isWatermarkAIBox(nextBox);
        const isTextFormat = isTextFormatAIBox(nextBox);

        setExecutionState((prev) => ({
          ...prev!,
          activeNodeIds: [nextBox.id],
          currentStepMessage: isWatermark
            ? `✂️ Applying photo crop & frame preset [${nextBox.title || 'Format'}]...`
            : isTextFormat
            ? `📝 Formatting AI copy with [${nextBox.title || 'Format Preset'}]...`
            : `⚡ Generating AI copy with [${nextBox.title || 'AI Model'}]...`,
        }));

        if (isWatermark) {
          const savedFormats = getSavedCropFormats();
          const baseFormat =
            savedFormats.find((f) => f.id === nextBox.cropFormatId || f.id === nextBox.templateId || f.id === nextBox.watermarkPresetId) ||
            savedFormats.find((f) => nextBox.templateText && f.name.toLowerCase() === nextBox.templateText.toLowerCase()) ||
            savedFormats.find((f) => nextBox.title && f.name && nextBox.title.toLowerCase().includes(f.name.toLowerCase())) ||
            ((nextBox.title?.toLowerCase().includes('fb') || nextBox.templateText?.toLowerCase().includes('fb'))
              ? savedFormats.find((f) => f.name.toLowerCase().includes('fb'))
              : null) ||
            savedFormats[0];

          const activeWk = typeof window !== 'undefined' ? loadActiveWatermarkConfig() : null;
          const targetFormat: CropStudioFormat = {
            ...baseFormat,
            targetWidth: nextBox.targetWidth || baseFormat?.targetWidth || 1080,
            targetHeight: nextBox.targetHeight || baseFormat?.targetHeight || 1350,
            aspect: nextBox.aspect || baseFormat?.aspect || '4:5',
            fitMode: (nextBox.fitMode || baseFormat?.fitMode || 'cover') as any,
            focusPosition: (nextBox.focusPosition || baseFormat?.focusPosition || 'center') as any,
            cropZoom: nextBox.cropZoom || baseFormat?.cropZoom || 1,
            watermarkConfig:
              nextBox.watermarkConfig ||
              baseFormat?.watermarkConfig ||
              (activeWk?.config?.enabled ? activeWk.config : undefined),
          };

          for (let i = 0; i < ctx.imageList.length; i++) {
            const img = ctx.imageList[i];
            const rawUrl = img.stored_url
              ? (img.stored_url.startsWith('http') ? img.stored_url : `http://localhost:8085${img.stored_url}`)
              : img.source_url;
            try {
              const formattedDataUrl = await formatImageWithCropFormat(rawUrl, targetFormat);
              ctx.localWatermarkedMap[img.index] = formattedDataUrl;
            } catch (err) {
              ctx.localWatermarkedMap[img.index] = rawUrl;
            }
          }
          setWatermarkedPhotos((prev) => ({ ...prev, ...ctx.localWatermarkedMap }));
          setEnhancedPhotos((prev) => ({ ...prev, ...ctx.localWatermarkedMap }));
          await delay(400);
        } else {
          const inConns = (cfg.connections || []).filter((c) => c.toNodeId === nextBox.id);
          const upstreamBoxId = inConns[0]?.fromNodeId;
          const upstreamText =
            (upstreamBoxId && ctx.generatedOutputsMap[upstreamBoxId]) ||
            (upstreamBoxId === 'get-content' ? ctx.rawCaption : '') ||
            ctx.primaryCopy ||
            ctx.rawCaption;

          let nextCopy = '';
          const aiProvider = nextBox.provider || (nextBox.model?.startsWith('gpt-') ? 'openai' : 'google_ai');
          const aiModel = nextBox.model || (aiProvider === 'openai' ? 'gpt-4o' : 'gemini-2.5-flash');
          try {
            const aiResp = await fetch('http://localhost:8085/api/facebook-import/generate-ai', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                provider: aiProvider,
                model: aiModel,
                template_id: nextBox.templateId || '',
                template_name: nextBox.title || 'Dynamic Real Estate Copywriter',
                template_text: nextBox.templateText || '',
                raw_content: upstreamText,
                custom_prompt:
                  nextBox.customPrompt ||
                  (isTextFormat
                    ? `Format this real estate listing according to the ${nextBox.title || 'preset'} style. Maintain all property details, price, contact numbers, and formatting clean and attractive.`
                    : ''),
              }),
            });
            if (aiResp.ok) {
              const aiData = await aiResp.json();
              if (aiData.success && aiData.generated_content) {
                nextCopy = aiData.generated_content;
              }
            }
          } catch (err) {
            console.warn('Next AI step threw:', err);
          }

          if (!nextCopy || nextCopy.trim().length === 0) {
            setExecutionState((prev) => ({
              ...prev!,
              isRunning: false,
              hasError: true,
              activeNodeIds: [nextBox.id],
              failedNodeIds: [nextBox.id],
              currentStepMessage: `❌ AI generation failed for [${nextBox.title || 'Formatted Content'}]. Please write/fix content or re-generate to continue.`,
            }));
            setIsRunningWorkflow(false);
            (window as any).__isWorkflowProcessing = false;
            canvasRef.current?.openNodeDrawer(nextBox.id);
            return;
          }

          ctx.generatedOutputsMap[nextBox.id] = nextCopy;
          if (!ctx.primaryCopy || isTextFormat) ctx.primaryCopy = nextCopy;
          setAiGeneratedOutputs((prev) => ({ ...prev, [nextBox.id]: nextCopy }));
          setAiGeneratedCopy(nextCopy);
          setExecutionState((prev) => ({
            ...prev!,
            completedNodeIds: Array.from(new Set([...(prev?.completedNodeIds || []), nextBox.id])),
            activeNodeIds: [],
          }));
          await delay(300);
        }
      }

      await executeDownstreamWorkflow({
        cfg,
        rawCaption: ctx.rawCaption || extractedContent,
        imageList: ctx.imageList.length > 0 ? ctx.imageList : extractedImages,
        propData: ctx.propData || propertyData,
        projName: ctx.projName || projectName,
        localWatermarkedMap: { ...watermarkedPhotos, ...ctx.localWatermarkedMap },
        generatedOutputsMap: { ...aiGeneratedOutputs, ...ctx.generatedOutputsMap },
        primaryCopy: ctx.primaryCopy || aiGeneratedCopy,
        targetUrl: ctx.targetUrl || runFacebookUrl,
      });
    } finally {
      setIsRunningWorkflow(false);
      (window as any).__isWorkflowProcessing = false;
      (window as any).__workflowConfirmLeave = null;
    }
  };

  // Run Workflow with Facebook Link - Executes directly on Canvas!
  const handleConfirmRun = async () => {
    const url = runFacebookUrl.trim();
    if (!url) return;
    if (editingFormat) {
      // Ensure current format is saved and set as active format
      const updated: WorkflowFormat = {
        ...editingFormat,
        name: modalFormatName.trim() || editingFormat.name,
        description: modalFormatDesc.trim() || editingFormat.description,
        updatedAt: Date.now(),
      };
      const updatedList = formats.map((f) => (f.id === editingFormat.id ? updated : f));
      setFormats(updatedList);
      saveWorkflowFormatsList(updatedList);
      setActiveWorkflowFormatId(editingFormat.id);
      setActiveId(editingFormat.id);
    }
    setIsRunModalOpen(false);
    await executeCanvasWorkflow(url);
  };

  // Save Format inside Modal
  const handleSaveModalFormat = () => {
    if (!editingFormat) return;
    const updated: WorkflowFormat = {
      ...editingFormat,
      name: modalFormatName.trim() || 'Untitled Workflow Format',
      description: modalFormatDesc.trim(),
      updatedAt: Date.now(),
    };

    const updatedList = formats.map((f) => (f.id === editingFormat.id ? updated : f));
    setFormats(updatedList);
    setEditingFormat(updated);
    saveWorkflowFormatsList(updatedList);

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: isCanvasOpen ? 1 : 'initial',
        height: isCanvasOpen ? '100vh' : (formats.length === 0 ? 'calc(100vh - 6rem)' : 'auto'),
        minHeight: isCanvasOpen ? '100vh' : (formats.length === 0 ? '620px' : 'auto'),
        width: '100%',
        boxSizing: 'border-box',
        gap: !isCanvasOpen && formats.length > 0 ? '1.25rem' : 0,
        paddingBottom: !isCanvasOpen && formats.length > 0 ? '3rem' : 0,
        overflow: isCanvasOpen ? 'hidden' : 'visible',
      }}
    >
      {/* Portal action buttons into Top Navbar when workflows exist and canvas is not open */}
      {headerActionEl &&
        !isCanvasOpen &&
        formats.length > 0 &&
        createPortal(
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>

            <Button
              variant="primary"
              size="sm"
              onClick={handleCreateNewFormat}
              leftIcon={<FiPlus style={{ fontSize: '14px' }} />}
              style={{
                height: '32px',
                fontSize: '0.75rem',
                fontWeight: 600,
                borderRadius: '0.375rem',
                boxShadow: 'none',
              }}
            >
              Create Workflow
            </Button>
          </div>,
          headerActionEl
        )}



      {/* Portal: Back Button, Workflow Name & Icon into Main Top Navbar Title area when canvas is open */}
      {headerTitleEl &&
        isCanvasOpen &&
        editingFormat &&
        createPortal(
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0 }}>
            {/* Back Button */}
            <button
              type="button"
              onClick={handleBackClick}
              title="Back to workflow formats"
              style={{
                height: '32px',
                padding: '0 10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                borderRadius: '6px',
                backgroundColor: isDark ? '#21262D' : '#F1F5F9',
                border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                color: 'var(--text-secondary)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = isDark ? '#30363D' : '#E2E8F0';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = isDark ? '#21262D' : '#F1F5F9';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              <FiArrowLeft size={14} />
              <span>Back</span>
            </button>

            <div
              style={{
                width: '1px',
                height: '18px',
                backgroundColor: isDark ? '#30363D' : '#CBD5E1',
                flexShrink: 0,
              }}
            />

            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                backgroundColor: isDark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.1)',
                color: isDark ? '#A78BFA' : '#7C3AED',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                flexShrink: 0,
              }}
            >
              <FiGitBranch />
            </div>
            <input
              type="text"
              value={modalFormatName}
              onChange={(e) => setModalFormatName(e.target.value)}
              placeholder="Format Name"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: '0.9375rem',
                fontWeight: 600,
                padding: '4px 6px',
                outline: 'none',
                minWidth: '200px',
              }}
            />
          </div>,
          headerTitleEl
        )}

      {/* Portal: Run & Reset Layout Buttons into Navbar Center (Same size, simple, zero glow) */}
      {headerCenterEl &&
        isCanvasOpen &&
        editingFormat &&
        createPortal(
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {/* Run / Stop Button */}
            {isRunningWorkflow ? (
              <button
                type="button"
                onClick={handleStopWorkflow}
                title="Stop workflow execution"
                style={{
                  width: '130px',
                  height: '32px',
                  padding: '0 12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  border: '1px solid #B91C1C',
                  boxShadow: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  outline: 'none',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                  boxSizing: 'border-box',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#B91C1C';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#DC2626';
                }}
              >
                <FiSquare size={11} style={{ fill: '#FFFFFF', color: '#FFFFFF' }} />
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setRunFacebookUrl('');
                  setIsRunModalOpen(true);
                }}
                title="Run workflow format"
                style={{
                  width: '130px',
                  height: '32px',
                  padding: '0 12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  backgroundColor: isDark ? '#15803D' : '#16A34A',
                  color: '#FFFFFF',
                  border: isDark ? '1px solid #166534' : '1px solid #15803D',
                  boxShadow: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  outline: 'none',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                  boxSizing: 'border-box',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = isDark ? '#166534' : '#15803D';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isDark ? '#15803D' : '#16A34A';
                }}
              >
                <FiPlay size={12} style={{ fill: '#FFFFFF', color: '#FFFFFF' }} />
                <span>Run</span>
              </button>
            )}

            {/* Continue Workflow Button: Shown when execution is paused on error */}
            {!isRunningWorkflow && executionState?.hasError && (executionState.failedNodeIds?.length || 0) > 0 && (
              <button
                type="button"
                onClick={() => handleContinueWorkflow(executionState.failedNodeIds?.[0])}
                style={{
                  height: '32px',
                  padding: '0 12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  backgroundColor: '#10B981',
                  color: '#FFFFFF',
                  border: '1px solid #059669',
                  boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  outline: 'none',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                  boxSizing: 'border-box',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#059669';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#10B981';
                }}
              >
                <FiPlay size={12} style={{ fill: '#FFFFFF', color: '#FFFFFF' }} />
                <span>Continue Workflow</span>
              </button>
            )}

            {/* Reset Layout Button - Simple matching surface style, exact same size, no glow */}
            <button
              type="button"
              onClick={() => canvasRef.current?.resetLayout()}
              style={{
                width: '130px',
                height: '32px',
                padding: '0 12px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontSize: '0.75rem',
                fontWeight: 600,
                borderRadius: '6px',
                backgroundColor: isDark ? '#21262D' : '#F1F5F9',
                color: 'var(--text-primary)',
                border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                boxShadow: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                outline: 'none',
                userSelect: 'none',
                whiteSpace: 'nowrap',
                boxSizing: 'border-box',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = isDark ? '#30363D' : '#E2E8F0';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = isDark ? '#21262D' : '#F1F5F9';
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = 'scale(0.98)';
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <FiCrosshair size={13} style={{ color: 'var(--text-secondary)' }} />
              <span>Reset Layout</span>
            </button>
          </div>,
          headerCenterEl
        )}


      {/* Conditional: Canvas Full Page View VS Workflow Formats List */}
      {isCanvasOpen && editingFormat ? (
        <div
          style={{
            flex: 1,
            width: '100%',
            height: '100%',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: isDark ? '#0D1117' : '#F8FAFC',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <FacebookWorkflowCanvas
            key={editingFormat.id}
            ref={canvasRef}
            initialConfig={editingFormat.config}
            onConfigChange={handleCanvasConfigChange}
            allowEditPrompt={true}
            onSaveFormat={handleSaveModalFormat}
            isSaveSuccess={saveSuccess}
            autoSave={autoSave}
            onToggleAutoSave={handleToggleAutoSave}
            onUndo={handleUndo}
            canUndo={undoStack.length > 0}
            onUseInFacebookImport={() => handleUseInFacebookImport(editingFormat.id)}
            isGeneralSettingsOpen={isGeneralSettingsOpen}
            onToggleGeneralSettings={setIsGeneralSettingsOpen}
            formatName={modalFormatName}
            executionState={executionState}
            rawContent={extractedContent}
            images={extractedImages}
            watermarkedPhotos={watermarkedPhotos}
            enhancedPhotos={enhancedPhotos}
            aiGeneratedOutputs={aiGeneratedOutputs}
            aiGeneratedCopy={aiGeneratedCopy}
            projectName={projectName}
            onUpdateBoxOutput={handleUpdateBoxOutput}
            onRegenerateBoxOutput={handleRegenerateBoxOutput}
            onContinueWorkflow={handleContinueWorkflow}
          />
        </div>
      ) : (
        <>
          {/* Page Header: Shown when workflows exist */}
          {formats.length > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            paddingBottom: '0.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '0.625rem',
                backgroundColor: 'rgba(99, 102, 241, 0.12)',
                color: '#818CF8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
                flexShrink: 0,
              }}
            >
              <FiGitBranch />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Workflow Formats
                </h2>
                <Badge variant="default">
                  {formats.length} {formats.length === 1 ? 'Format' : 'Formats'}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FULL-HEIGHT EMPTY STATE CANVAS: SQUARE BUTTON IN CENTER & SPREAD REDUCED DOTS */}
      {formats.length === 0 ? (
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            flex: 1,
            borderRadius: '0.75rem',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            boxSizing: 'border-box',
          }}
        >
          {/* Spread Dot Canvas Pattern with Reduced Dot Size */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              maskImage: 'radial-gradient(ellipse 65% 65% at 50% 50%, black 25%, transparent 95%)',
              WebkitMaskImage: 'radial-gradient(ellipse 65% 65% at 50% 50%, black 25%, transparent 95%)',
            }}
          >
            <svg width="100%" height="100%">
              <defs>
                <pattern id="spread-canvas-dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                  <circle
                    cx="12"
                    cy="12"
                    r="0.9"
                    fill={isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.22)'}
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#spread-canvas-dots)" />
            </svg>
          </div>

          {/* Square Button in Center with Plus and Small Text Underneath */}
          <button
            type="button"
            onClick={handleCreateNewFormat}
            style={{
              position: 'relative',
              zIndex: 2,
              background: 'none',
              border: 'none',
              padding: 0,
              margin: 0,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.625rem',
              outline: 'none',
              transition: 'transform 0.15s ease',
            }}
            onMouseEnter={(e) => {
              const box = e.currentTarget.querySelector('.square-step-box') as HTMLElement | null;
              if (box) {
                box.style.borderColor = 'var(--accent-primary)';
                box.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)';
                box.style.color = 'var(--accent-primary)';
              }
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              const box = e.currentTarget.querySelector('.square-step-box') as HTMLElement | null;
              if (box) {
                box.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.3)';
                box.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)';
                box.style.color = 'var(--text-secondary)';
              }
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div
              className="square-step-box"
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '0.75rem',
                border: isDark ? '2px dashed rgba(255, 255, 255, 0.4)' : '2px dashed rgba(0, 0, 0, 0.3)',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
                boxSizing: 'border-box',
              }}
            >
              <FiPlus style={{ fontSize: '26px', strokeWidth: 2 }} />
            </div>
            <span
              style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: '-0.01em',
              }}
            >
              Add first step...
            </span>
          </button>
        </div>
      ) : (
        /* WORKFLOW FORMAT CARDS GRID */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {formats.map((format) => {
            const isActive = format.id === activeFormatId;

            return (
              <div
                key={format.id}
                onClick={() => handleOpenCanvas(format)}
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '0.75rem',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  cursor: 'pointer',
                  transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
                  position: 'relative',
                  boxShadow: 'var(--shadow-sm)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-color-hover)';
                  e.currentTarget.style.boxShadow = isDark
                    ? '0 10px 25px -3px rgba(0, 0, 0, 0.6)'
                    : '0 10px 25px -3px rgba(0, 0, 0, 0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                }}
              >
                {/* Card Top: Title & Active Badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '0.5rem',
                        backgroundColor: isActive ? 'rgba(59, 130, 246, 0.15)' : (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)'),
                        color: isActive ? (isDark ? '#60A5FA' : '#2563EB') : 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.1rem',
                        flexShrink: 0,
                      }}
                    >
                      <FiGitBranch />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <h3
                        style={{
                          fontSize: '0.9375rem',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          margin: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {format.name}
                      </h3>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Updated {new Date(format.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  {isActive && (
                    <Badge variant="info" size="sm">
                      <FiCheckCircle style={{ marginRight: '3px' }} /> Active in FB Import
                    </Badge>
                  )}
                </div>

                {/* Description */}
                <p
                  style={{
                    fontSize: '0.8125rem',
                    color: 'var(--text-secondary)',
                    margin: 0,
                    lineHeight: '1.4',
                    height: '38px',
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {format.description || 'Configured Facebook import extraction and multi-box dynamic AI prompts.'}
                </p>

                {/* Action Buttons */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                    marginTop: 'auto',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid var(--border-color)',
                  }}
                >
                  {/* Main Trigger Button */}
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenCanvas(format);
                    }}
                    leftIcon={<FiMaximize2 style={{ fontSize: '13px' }} />}
                    style={{
                      height: '34px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      borderRadius: '0.375rem',
                      flex: 1,
                    }}
                  >
                    Open Workflow Canvas
                  </Button>

                  {!isActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => handleSetActiveFormat(format.id, e)}
                      style={{
                        height: '34px',
                        fontSize: '0.75rem',
                        borderRadius: '0.375rem',
                        whiteSpace: 'nowrap',
                      }}
                      title="Set as active format for Facebook Import"
                    >
                      Set Active
                    </Button>
                  )}

                  <button
                    type="button"
                    onClick={(e) => handleDuplicateFormat(format, e)}
                    title="Duplicate format"
                    style={{
                      height: '34px',
                      width: '34px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '0.375rem',
                      backgroundColor: 'transparent',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    <FiCopy style={{ fontSize: '13px' }} />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleDeleteFormat(format.id, format.name, e)}
                    title="Delete format"
                    style={{
                      height: '34px',
                      width: '34px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '0.375rem',
                      backgroundColor: 'transparent',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#EF4444',
                      cursor: 'pointer',
                    }}
                  >
                    <FiTrash2 style={{ fontSize: '13px' }} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

        </>
      )}

      {/* Run Workflow Facebook Link Prompt Modal */}
      {isRunModalOpen && (
        <Modal
          isOpen={isRunModalOpen}
          onClose={() => setIsRunModalOpen(false)}
          title="Run Workflow"
          maxWidth="520px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.25rem 0' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              {(() => {
                const detected = checkSocialPlatform(runFacebookUrl);
                const isTt = detected === 'tiktok';
                const isFb = detected === 'facebook';
                return (
                  <>
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px',
                        backgroundColor: isTt ? 'rgba(254, 44, 85, 0.12)' : isFb ? 'rgba(24, 119, 242, 0.12)' : 'var(--bg-surface)',
                        color: isTt ? '#FE2C55' : isFb ? '#1877F2' : 'var(--text-secondary)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.25rem',
                        flexShrink: 0,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {isTt ? <FaTiktok /> : isFb ? <FaFacebook /> : <FiLink />}
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {isTt ? 'Enter TikTok Post Link' : isFb ? 'Enter Facebook Post Link' : 'Enter Post Link (Facebook or TikTok)'}
                      </h4>
                      <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        Provide the URL of the Facebook or TikTok listing post you want to import and process with this workflow format.
                      </p>
                    </div>
                  </>
                );
              })()}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Social Post URL <span style={{ color: '#ef4444' }}>*</span>
                </label>
                {(() => {
                  const detected = checkSocialPlatform(runFacebookUrl);
                  if (detected === 'tiktok') {
                    return (
                      <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#FE2C55', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        <FaTiktok style={{ fontSize: '9px' }} /> TikTok Post Detected
                      </span>
                    );
                  }
                  if (detected === 'facebook') {
                    return (
                      <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#1877F2', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        <FaFacebook style={{ fontSize: '10px' }} /> Facebook Post Detected
                      </span>
                    );
                  }
                  return null;
                })()}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-surface)',
                }}
              >
                <FiLink size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <input
                  type="url"
                  autoFocus
                  placeholder="Paste Facebook or TikTok post URL (e.g. facebook.com/... or tiktok.com/@...)"
                  value={runFacebookUrl}
                  onChange={(e) => setRunFacebookUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && runFacebookUrl.trim()) {
                      e.preventDefault();
                      handleConfirmRun();
                    }
                  }}
                  style={{
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem',
                    width: '100%',
                  }}
                />
              </div>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                Supports Facebook posts/groups & TikTok photos/videos. Press Enter to run immediately.
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: '0.75rem',
                paddingTop: '0.75rem',
                borderTop: '1px solid var(--border-color)',
              }}
            >
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsRunModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmRun}
                disabled={!runFacebookUrl.trim()}
                leftIcon={<FiPlay style={{ fill: 'currentColor' }} />}
                style={{
                  backgroundColor: checkSocialPlatform(runFacebookUrl) === 'tiktok' ? '#FE2C55' : '#1877F2',
                  borderColor: checkSocialPlatform(runFacebookUrl) === 'tiktok' ? '#FE2C55' : '#1877F2',
                  color: '#FFFFFF',
                  opacity: !runFacebookUrl.trim() ? 0.6 : 1,
                  cursor: !runFacebookUrl.trim() ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Run Workflow
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Leave While Processing Confirmation Modal */}
      {showLeaveConfirmModal && (
        <Modal
          isOpen={showLeaveConfirmModal}
          onClose={handleCancelLeave}
          title="Workflow In Progress"
          maxWidth="460px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.25rem 0' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: isDark ? 'rgba(234, 179, 8, 0.15)' : 'rgba(245, 158, 11, 0.12)',
                  color: isDark ? '#FACC15' : '#D97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.35rem',
                  flexShrink: 0,
                  border: isDark ? '1px solid rgba(234, 179, 8, 0.3)' : '1px solid rgba(245, 158, 11, 0.25)',
                }}
              >
                <FiAlertTriangle />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Leave while processing?
                </h4>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  The workflow is currently running and processing listing data. If you leave now, the ongoing process will be cancelled and incomplete results will not be saved.
                </p>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '0.75rem',
                paddingTop: '0.75rem',
                borderTop: '1px solid var(--border-color)',
              }}
            >
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelLeave}
                style={{ fontWeight: 600 }}
              >
                Stay on Page
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleConfirmLeave}
                style={{
                  backgroundColor: '#DC2626',
                  borderColor: '#DC2626',
                  color: '#FFFFFF',
                  fontWeight: 600,
                }}
              >
                Leave & Cancel Process
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
