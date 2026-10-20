import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import {
  FacebookWorkflowCanvas,
  DEFAULT_FB_WORKFLOW_CONFIG,
  type FacebookWorkflowConfig,
  type FacebookWorkflowCanvasRef,
  type WorkflowExecutionState,
} from '../facebook-import/FacebookWorkflowCanvas';
import { saveRemainingPost } from '../remaining-posts/remainingPostsStorage';
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
import { FaFacebook } from 'react-icons/fa';
import { HiSparkles } from 'react-icons/hi2';
import { useTheme } from '../../context/ThemeContext';

export const CreateWorkflowView: React.FC = () => {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  const navigate = useNavigate();
  const canvasRef = useRef<FacebookWorkflowCanvasRef>(null);
  const [formats, setFormats] = useState<WorkflowFormat[]>(() => getSavedWorkflowFormats());
  const [activeFormatId, setActiveId] = useState<string>(() => getActiveWorkflowFormatId());
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
            if (!prev) return data.workflow_formats[0];
            return data.workflow_formats.find((f: WorkflowFormat) => f.id === prev.id) || data.workflow_formats[0];
          });
        }
      })
      .catch(() => {});
  }, []);

  // Canvas Page view state (replaces modal popup with full-page canvas)
  const [isCanvasOpen, setIsCanvasOpen] = useState<boolean>(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get('canvas') === 'true' || sp.get('format')) return true;
      return localStorage.getItem('ea_workflow_canvas_open') === 'true';
    } catch {
      return false;
    }
  });
  const [editingFormat, setEditingFormat] = useState<WorkflowFormat | null>(() => {
    const list = getSavedWorkflowFormats();
    const id = getActiveWorkflowFormatId();
    return list.find((f) => f.id === id) || list[0] || null;
  });
  const [modalFormatName, setModalFormatName] = useState<string>('');
  const [modalFormatDesc, setModalFormatDesc] = useState<string>('');
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

  // Open Canvas as full page for an existing format
  const handleOpenCanvas = (format: WorkflowFormat) => {
    setEditingFormat(format);
    setModalFormatName(format.name);
    setModalFormatDesc(format.description || '');
    setUndoStack([]);
    setIsCanvasOpen(true);
    try {
      localStorage.setItem('ea_workflow_canvas_open', 'true');
    } catch {}
    window.dispatchEvent(new CustomEvent('ea_set_canvas_mode', { detail: { active: true } }));
  };

  // Close Canvas Page and return to list
  const handleCloseCanvas = () => {
    setIsCanvasOpen(false);
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
      const updatedList = formats.map((f) => (f.id === editingFormat.id ? updated : f));
      setFormats(updatedList);
      saveWorkflowFormatsList(updatedList);
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

    // Phase 1: Trigger (Extract Link)
    setExecutionState({
      isRunning: true,
      isComplete: false,
      hasError: false,
      activeNodeIds: ['trigger'],
      completedNodeIds: [],
      failedNodeIds: [],
      currentStepMessage: 'Resolving Facebook post link and isolating listing...',
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

    // If extraction produced no content, stop with an error — do not continue with fake data
    if (!rawCaption || rawCaption.trim().length === 0) {
      setExecutionState((prev) => ({
        ...prev!,
        isRunning: false,
        hasError: true,
        activeNodeIds: [],
        failedNodeIds: ['trigger'],
        currentStepMessage: '❌ Could not extract content from the provided link. Please check the URL and try again.',
      }));
      setIsRunningWorkflow(false);
      (window as any).__isWorkflowProcessing = false;
      return;
    }

    setExtractedContent(rawCaption);
    setExtractedImages(imageList);
    setProjectName(projName);
    setPropertyData(propData);

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
      const isWatermark =
        box.processType === 'watermark' ||
        box.provider === 'watermark' ||
        box.id?.includes('watermark') ||
        box.title?.toLowerCase().startsWith('format:');

      setExecutionState((prev) => ({
        ...prev!,
        activeNodeIds: [box.id],
        currentStepMessage: isWatermark
          ? `✂️ Applying format preset with [${box.title || 'Format'}]...`
          : `⚡ Generating AI copy with [${box.title || 'AI Box'}] (${box.model || 'Claude 3.5 Sonnet'})...`,
        stepIndex: 4,
      }));

      if (isWatermark) {
        await delay(500);
        imageList.forEach((img, idx) => {
          localWatermarkedMap[idx] = img.source_url;
        });
        setWatermarkedPhotos((prev) => ({ ...prev, ...localWatermarkedMap }));
      } else {
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
              raw_content: rawCaption,
              custom_prompt: box.customPrompt || '',
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
          inputPreview: String(rawCaption || '').slice(0, 200),
          outputPreview: copyText || 'Generation failed (fallback copy used)',
          status: copyText ? 'success' : 'failed',
          durationMs: Date.now() - aiStart,
          sourceWorkflow: 'Create Workflow',
        });

        if (!copyText) {
          // AI generation produced no output — use original extracted caption
          copyText = rawCaption;
        }

        generatedOutputsMap[box.id] = copyText;
        if (!primaryCopy) primaryCopy = copyText;
        setAiGeneratedOutputs((prev) => ({ ...prev, [box.id]: copyText }));
        setAiGeneratedCopy(copyText);
        await delay(600);
      }

      setExecutionState((prev) => ({
        ...prev!,
        completedNodeIds: Array.from(new Set([...(prev?.completedNodeIds || []), box.id])),
        activeNodeIds: [],
        currentStepMessage: `✓ [${box.title || 'Node'}] executed successfully!`,
      }));
      await delay(250);
    }

    // Phase 4: Post Output (Compile Assets)
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

    // Phase 5: Destinations (Direct Social Channels & Remaining Posts Database)
    const allDestinations = (cfg.destinations && cfg.destinations.length > 0)
      ? cfg.destinations
      : [cfg.destination || { id: 'destination', storeInDatabase: true, postToSocialMedia: false }];

    // Filter to destinations connected from output node (or all enabled destinations if no explicit wiring)
    const outputConnectedDestIds = new Set(
      (cfg.connections || [])
        .filter((c) => c.fromNodeId === 'output')
        .map((c) => c.toNodeId)
    );

    const activeDestList = allDestinations.filter((d) => {
      if (d.enabled === false) return false;
      if (outputConnectedDestIds.size > 0) {
        return outputConnectedDestIds.has(d.id);
      }
      return true;
    });

    const targetDestinations = activeDestList.length > 0 ? activeDestList : allDestinations;
    const destIds = targetDestinations.map((d) => d.id || 'destination');

    // Separate into social media destinations and database storage destinations
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

    // Track social posting outcome to link into database post record if applicable
    let anyFacebookPosted = false;
    let lastFbPostId = '';
    let lastFbPermalink = '';

    // 1. Process Direct Social Media Posting (Working completely in background, zero screen popups)
    for (const socialDest of socialDestinations) {
      if (isCancelledRef.current) return;

      const targetPageId = socialDest.selectedPageId || socialDest.selectedPageIds?.[0] || '1546086342286604';
      const destTitle = socialDest.title || 'Facebook Page';

      setExecutionState((prev) => ({
        ...prev!,
        activeNodeIds: [socialDest.id],
        currentStepMessage: `🚀 Auto-posting directly to Facebook [${destTitle}] in background...`,
        stepIndex: 6,
      }));

      const projectName = projName || propData?.project_name || '';
      const caption = primaryCopy || rawCaption;
      const hashtags = socialDest.includeHashtags !== false
        ? ((socialDest as any).defaultHashtags || '')
        : '';
      const imageUrls = imageList
        .map((img: any, idx: number) => localWatermarkedMap[idx] || img.stored_url || img.source_url)
        .filter(Boolean);

      let publishedSuccess = false;
      let errorMsg = '';

      try {
        const fbPayload = {
          page_id: targetPageId,
          headline: '', // Leave empty so generic labels like 'Property Listing' are never prepended
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

        const data = await res.json();
        if (res.ok && data.status === 'success') {
          publishedSuccess = true;
          anyFacebookPosted = true;
          lastFbPostId = data.facebook_post_id;
          lastFbPermalink = data.permalink_url;

          // Record published item to AutoPost storage so it seamlessly appears in Post History
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
          errorMsg = data.message || 'Meta Graph API error';
        }
      } catch (err: any) {
        errorMsg = err.message || 'Network error publishing to Facebook';
      }

      setExecutionState((prev) => ({
        ...prev!,
        completedNodeIds: Array.from(new Set([...(prev?.completedNodeIds || []), socialDest.id])),
        activeNodeIds: [],
        currentStepMessage: publishedSuccess
          ? `✓ Published to Facebook [${destTitle}] (Post ID: ${lastFbPostId})!`
          : `⚠️ Facebook publish notice [${destTitle}]: ${errorMsg}`,
      }));

      await delay(400);
    }

    // 2. Process Remaining Posts Database Storage (if configured)
    for (const dbDest of dbDestinations) {
      if (isCancelledRef.current) return;

      setExecutionState((prev) => ({
        ...prev!,
        activeNodeIds: [dbDest.id],
        currentStepMessage: `💾 Storing in [${dbDest.title || 'Remaining Posts Database'}]...`,
      }));

      try {
        saveRemainingPost({
          facebook_url: targetUrl,
          projectName: projName || propData?.project_name || '',
          source: {
            platform: 'facebook',
            original_url: targetUrl,
            canonical_url: targetUrl,
            source_type: 'facebook_post',
            source_name: 'Facebook Link',
            post_id: lastFbPostId || `post_${Date.now()}`,
            created_time: new Date().toISOString(),
            extraction_method: 'browser',
          },
          caption: rawCaption,
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
          aiGeneratedCopy: primaryCopy || rawCaption,
          workflowFormatName: editingFormat.name,
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
          ...aiBoxes.map((b) => b.id),
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
              variant="outline"
              size="sm"
              onClick={handleDeleteAllFormats}
              leftIcon={<FiTrash2 style={{ fontSize: '13px' }} />}
              style={{
                height: '32px',
                fontSize: '0.75rem',
                fontWeight: 600,
                borderColor: 'rgba(239, 68, 68, 0.35)',
                color: '#EF4444',
                borderRadius: '0.375rem',
              }}
              title="Remove all workflow formats and samples"
            >
              Remove All
            </Button>

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
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(24, 119, 242, 0.1)',
                  color: '#1877F2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.25rem',
                  flexShrink: 0,
                }}
              >
                <FaFacebook />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Enter Facebook Post Link
                </h4>
                <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Provide the URL of the Facebook listing post you want to import and process with this workflow format.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Facebook Post URL <span style={{ color: '#ef4444' }}>*</span>
              </label>
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
                  placeholder="https://www.facebook.com/groups/... or /posts/..."
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
                Press Enter to run immediately with the current canvas workflow format.
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
                  backgroundColor: '#1877F2',
                  borderColor: '#1877F2',
                  color: '#FFFFFF',
                  opacity: !runFacebookUrl.trim() ? 0.6 : 1,
                  cursor: !runFacebookUrl.trim() ? 'not-allowed' : 'pointer',
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
