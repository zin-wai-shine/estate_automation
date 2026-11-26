import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  FiMonitor,
  FiRefreshCw,
  FiExternalLink,
  FiCopy,
  FiCheck,
  FiPlay,
  FiPause,
  FiRotateCcw,
  FiFastForward,
  FiXCircle,
  FiFolder,
  FiLayers,
  FiCpu,
  FiSliders,
  FiShield,
  FiCheckCircle,
  FiAlertCircle,
  FiGlobe,
  FiUserPlus,
  FiPlus,
  FiX,
  FiUploadCloud,
  FiArrowLeft,
  FiImage,
  FiEye,
  FiLoader,
  FiStar,
  FiZap,
  FiSettings,
  FiFileText,
  FiEdit3,
  FiSearch,
  FiSquare,
  FiMaximize2,
  FiTrash2,
  FiDownload,
} from 'react-icons/fi';
import { FaChrome } from 'react-icons/fa';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { ToggleSwitch } from '../../components/ui/ToggleSwitch';
import {
  getPersistedReferenceImage,
  loadPersistedReferenceImageAsync,
  savePersistedReferenceImage,
  clearPersistedReferenceImage,
  isReferenceImageExplicitlyDeleted,
} from './referenceImageStorage';
import {
  fetchBrowserProfiles,
  openBrowserProfile,
  openBrowserTab,
  fetchTabGroups,
  fetchProcessingLanes,
  fetchImageQueue,
  startImageQueue,
  pauseImageJob,
  resumeImageJob,
  retryImageJob,
  skipImageJob,
  cancelImageJob,
  processLocalImageJob,
  fetchPromptPreview,
  fetchDownloadWatcherStatus,
  syncBrowserProfiles,
  registerBrowserProfile,
  startAutomation,
  stopAutomation,
  getAutomationStatus,
  focusBrowserTabGroup,
  waitForBrowserTabsReady,
  createBatchImageQueue,
  fetchEnhancedDownloadedImages,
  type EnhancedDownloadedImage,
  type AutomationStatusResponse,
} from './browserAutomationService';
import {
  STANDARD_BROWSER_PROMPTS,
  resolvePromptForBrowserNode,
  getPersistedPromptKey,
  getPersistedPromptText,
  getPersistedCustomPrompt,
  setPersistedPromptSelection,
  isEnhanceCategory,
  isGenerateCategory,
} from './browserPromptUtils';
import { loadAvailablePromptTemplates } from '../facebook-import/FacebookWorkflowCanvas';
import { extractCleanCondoNameFromAiText } from './FBHeroSettingsSidebox';
import { AttachmentGroupsManager, type AttachmentStep, resolveAttachedPhotosFromSteps, type WorkflowImageSource, clearCondoFolderCache } from './AttachmentGroupsManager';
import type {
  BrowserProfile,
  BrowserGroupItem,
  BrowserTabItem,
  ProcessingLane,
  ImageProcessingJob,
  BrowserProcessingMode,
  DownloadManagerStatus,
} from './types';

interface ExternalBrowserSidebarProps {
  isDark: boolean;
  boxConfig: any;
  onUpdateBoxConfig: (updated: any) => void;
  availablePrompts?: Array<{ id: string; name: string; templateText: string; category?: string }>;
  propertyContext?: {
    id?: string;
    listingCode?: string;
    title?: string;
    aboveBoxTitle?: string;
    price?: string;
    images?: Array<{ url: string; index?: number; filename?: string }>;
    enhancedImages?: Array<{ url: string; index?: number; filename?: string }>;
    upstreamPrompts?: Array<{ id: string; title: string; text?: string; templateId?: string; generatedOutput?: string }>;
    upstreamTabGroups?: Array<{ id: string; title: string; browserGroupName?: string }>;
  };
  isProfileNode?: boolean;
  isTabGroupNode?: boolean;
  connectedProfileNodeId?: string;
  connectedProfileName?: string;
  connectedTabGroupNodes?: Array<{ id: string; title: string; subtitle?: string; browserGroupName?: string }>;
  onOpenProfileNode?: (nodeId: string) => void;
  onOpenTabGroupNode?: (nodeId: string) => void;
  onAddTabGroupNode?: (groupName: string, tabsCount: number) => void;
  onRunningChange?: (isRunning: boolean) => void;
  onOpenSettingsSidebox?: () => void;
  onCloseSettingsSidebox?: () => void;
  isSettingsSideboxOpen?: boolean;
  rawPostContent?: string;
  onRunCondoNameStep?: () => Promise<string | void>;
  onEnhancedPhotosUpdate?: (photos: Record<number, string>) => void;
  workflowImageSources?: WorkflowImageSource[];
  footerContainer?: HTMLElement | null;
}

export const ExternalBrowserSidebar: React.FC<ExternalBrowserSidebarProps> = ({
  isDark,
  boxConfig,
  onUpdateBoxConfig,
  availablePrompts = [],
  propertyContext,
  isProfileNode: propIsProfileNode,
  isTabGroupNode: propIsTabGroupNode,
  connectedProfileNodeId,
  connectedProfileName,
  connectedTabGroupNodes,
  onOpenProfileNode,
  onOpenTabGroupNode,
  onAddTabGroupNode,
  onRunningChange,
  onOpenSettingsSidebox: _onOpenSettingsSidebox,
  onCloseSettingsSidebox,
  isSettingsSideboxOpen,
  rawPostContent,
  onRunCondoNameStep,
  onEnhancedPhotosUpdate,
  workflowImageSources = [],
  footerContainer,
}) => {
  const [targetFooterEl, setTargetFooterEl] = useState<HTMLElement | null>(() => {
    if (footerContainer) return footerContainer;
    return typeof document !== 'undefined' ? document.getElementById('workflow-sidebar-pinned-footer') : null;
  });

  useEffect(() => {
    if (footerContainer) {
      setTargetFooterEl(footerContainer);
      return;
    }
    const el = document.getElementById('workflow-sidebar-pinned-footer');
    if (el) {
      setTargetFooterEl(el);
    } else {
      const timer = setTimeout(() => {
        setTargetFooterEl(document.getElementById('workflow-sidebar-pinned-footer'));
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [footerContainer]);
  const isTabGroupNode = Boolean(
    propIsTabGroupNode ||
    boxConfig.processType === 'chrome_tab_group' ||
    boxConfig.id?.includes('tabgroup') ||
    boxConfig.id?.includes('tab-group') ||
    boxConfig.title?.toLowerCase().includes('tab group') ||
    boxConfig.subtitle?.toLowerCase().includes('tabs') ||
    boxConfig.title?.toLowerCase().includes('hero') ||
    boxConfig.title?.toLowerCase().includes('enhance')
  );
  const isProfileNode = !isTabGroupNode && Boolean(
    propIsProfileNode ?? (boxConfig.processType === 'chrome_profile' || boxConfig.id?.includes('ai-box-chrome-'))
  );

  // Resolve Condo Name from selected Condo Name AI Box (or auto-detected 'Condo Name' AI box)
  const aiExtractedCondoName = useMemo(() => {
    const prompts = propertyContext?.upstreamPrompts || [];
    const targetBox =
      (boxConfig.condoNameAiBoxId && prompts.find((p) => p.id === boxConfig.condoNameAiBoxId)) ||
      prompts.find((p) => p.title.toLowerCase().includes('condo') || p.title.toLowerCase().includes('name'));
    if (targetBox?.generatedOutput) {
      return extractCleanCondoNameFromAiText(targetBox.generatedOutput);
    }
    return '';
  }, [propertyContext?.upstreamPrompts, boxConfig.condoNameAiBoxId]);

  const condoName =
    aiExtractedCondoName ||
    (propertyContext?.title && propertyContext.title !== 'Featured Property Listing' && propertyContext.title !== 'Facebook Property Post'
      ? propertyContext.title
      : '') ||
    boxConfig.browserCondoName ||
    '';
  const aboveBoxTitle = propertyContext?.aboveBoxTitle || 'Format: Enhance Image';

  const receivedImages = useMemo(() => {
    return (propertyContext?.images || [])
      .filter((img) => Boolean(img.url))
      .map((img, idx) => ({
        ...img,
        index: idx + 1,
        filename: img.filename || `Photo #${idx + 1}`,
      }));
  }, [propertyContext?.images]);

  // 4b. Dynamic Node Action Mode (Generate Image vs Enhance Images)
  const nodeTitle = (boxConfig.title || boxConfig.browserGroupName || '').toLowerCase();
  const currentTabGroupMode: 'generate' | 'enhance' =
    boxConfig.tabGroupMode === 'generate'
      ? 'generate'
      : boxConfig.tabGroupMode === 'enhance'
        ? 'enhance'
        : nodeTitle.includes('enhance')
          ? 'enhance'
          : 'generate';

  const isEnhanceNode = currentTabGroupMode === 'enhance';
  const isHeroNode = !isEnhanceNode;

  // Helper: Strictly verify that a downloaded hero/result image belongs to THIS specific node
  const isImageRelevantToThisNode = (
    img: { fileName?: string; condoName?: string; nodeId?: string; groupName?: string } | null,
    config: typeof boxConfig,
    grpName: string
  ): boolean => {
    if (!img || !img.fileName) return false;
    const fileName = (img.fileName || '').toLowerCase();
    const boxTitle = (config.title || '').toLowerCase();
    const group = (grpName || config.browserGroupName || '').toLowerCase();

    // 1. If explicit nodeId is attached and doesn't match, reject
    if (img.nodeId && config.id && img.nodeId !== config.id) {
      return false;
    }

    // 2. Identify node modality
    const isTikTokNode = boxTitle.includes('tiktok') || group.includes('tiktok');
    const isFacebookNode =
      boxTitle.includes('facebook') ||
      (boxTitle.includes('fb') && !boxTitle.includes('tiktok')) ||
      (group.includes('fb') && !group.includes('tiktok'));

    // 3. TikTok modality checks
    if (isTikTokNode) {
      // Reject any Facebook hero image
      if (
        fileName.startsWith('fb_hero') ||
        fileName.includes('facebook') ||
        (fileName.includes('fb_') && !fileName.includes('tiktok'))
      ) {
        return false;
      }
      // Brand separation: BoltHaven vs Dot
      const isBoltHaven = boxTitle.includes('bolthaven') || group.includes('bolthaven');
      const isDot = boxTitle.includes('dot') || group.includes('dot');
      if (isBoltHaven && (fileName.includes('dot_') || fileName.includes('dottiktok') || fileName.includes('dot_tiktok'))) {
        return false;
      }
      if (isDot && (fileName.includes('bolthaven') || fileName.includes('bh_') || fileName.includes('bolthaven_tiktok'))) {
        return false;
      }
      // Must be a genuine tiktok hero image
      if (!fileName.includes('tiktok')) {
        return false;
      }
    }

    // 4. Facebook modality checks
    if (isFacebookNode) {
      // Reject any TikTok hero image
      if (fileName.includes('tiktok')) {
        return false;
      }
    }

    return true;
  };

  // 1. Core Profile, Group, and Tab State
  const targetGroupName = useMemo(() => {
    if (boxConfig.title && boxConfig.title !== 'Tab Group' && !boxConfig.title.startsWith('External Browser')) {
      return boxConfig.title;
    }
    if (boxConfig.browserGroupName && boxConfig.browserGroupName !== 'Tab Group' && !boxConfig.browserGroupName.startsWith('External Browser')) {
      return boxConfig.browserGroupName;
    }
    return isHeroNode ? 'FB Hero' : (isTabGroupNode ? 'Tab Group' : 'Enhance IMG');
  }, [isHeroNode, isTabGroupNode, boxConfig.title, boxConfig.browserGroupName]);

  const [profiles, setProfiles] = useState<BrowserProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<number>(() => boxConfig.browserProfileId || 0);
  const [tabGroups, setTabGroups] = useState<BrowserGroupItem[]>([]);
  const [selectedGroupName, setSelectedGroupName] = useState<string>(() => targetGroupName);
  const [stagingGroupName, setStagingGroupName] = useState<string>(() => boxConfig.stagingGroupName || 'FB Hero');
  const [enableEnhanceGroup, setEnableEnhanceGroup] = useState<boolean>(() => boxConfig.enableEnhanceGroup !== false);
  const [enableStagingGroup, setEnableStagingGroup] = useState<boolean>(() => boxConfig.enableStagingGroup !== false);
  const [selectedTabId, setSelectedTabId] = useState<string>(() => boxConfig.browserTabId || '');
  const [processingMode, setProcessingMode] = useState<BrowserProcessingMode>(
    () => boxConfig.browserProcessingMode || 'chrome_assisted'
  );

  // 2. Lanes and Download Manager State
  const [lanes, setLanes] = useState<ProcessingLane[]>([]);
  const [selectedLaneKey, setSelectedLaneKey] = useState<string>(() => boxConfig.browserLaneKey || 'lane-1');
  const [downloadWatcher, setDownloadWatcher] = useState<DownloadManagerStatus | null>(null);

  // 3. Queue State
  const [queueJobs, setQueueJobs] = useState<ImageProcessingJob[]>([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);
  const [enhancedImages, setEnhancedImages] = useState<EnhancedDownloadedImage[]>([]);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderDraft, setOrderDraft] = useState<EnhancedDownloadedImage[]>([]);
  const [dragOrderIdx, setDragOrderIdx] = useState<number | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);
  const [isRegettingImages, setIsRegettingImages] = useState(false);
  const [regetFeedback, setRegetFeedback] = useState<string | null>(null);
  const [regettingSinglePos, setRegettingSinglePos] = useState<number | null>(null);
  const [deletingPos, setDeletingPos] = useState<number | null>(null);
  const [hoveredEnhancedCardKey, setHoveredEnhancedCardKey] = useState<string | null>(null);
  const [cacheBustTimestamp, setCacheBustTimestamp] = useState<number>(() => Date.now());

  // 4. Prompt Template State (Persisted uniquely per node)
  const [selectedPromptKey, setSelectedPromptKey] = useState<string>(() => {
    if (isHeroNode) {
      if (boxConfig.browserPromptTemplateKey && (boxConfig.browserPromptTemplateKey.includes('hero') || boxConfig.browserPromptTemplateKey.includes('fb') || boxConfig.browserPromptTemplateKey.includes('generate'))) {
        return boxConfig.browserPromptTemplateKey;
      }
      return 'fb_hero_master';
    }
    if (isEnhanceNode) {
      if (boxConfig.browserPromptTemplateKey && !boxConfig.browserPromptTemplateKey.includes('hero') && !boxConfig.browserPromptTemplateKey.includes('fb')) {
        return boxConfig.browserPromptTemplateKey;
      }
      return 'photo_retouch';
    }
    if (boxConfig.browserPromptTemplateKey) return boxConfig.browserPromptTemplateKey;
    if (boxConfig.templateId && boxConfig.templateId !== 'chrome-tab-group') return boxConfig.templateId;
    return 'photo_retouch';
  });
  const [customPromptText, setCustomPromptText] = useState<string>(() => {
    return boxConfig.browserCustomPrompt || boxConfig.customPrompt || '';
  });
  const [resolvedPromptPreview, setResolvedPromptPreview] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);
  const [showPromptViewSidebox, setShowPromptViewSidebox] = useState(false);

  useEffect(() => {
    if (isSettingsSideboxOpen) {
      setShowPromptViewSidebox(false);
    }
  }, [isSettingsSideboxOpen]);

  const [enablePromptEnhance, setEnablePromptEnhance] = useState<boolean>(() => {
    return boxConfig.enablePromptEnhance !== false;
  });

  const [imageSourceMode, setImageSourceMode] = useState<'all' | 'hero_only' | 'selected' | 'upstream_group' | 'custom_upload'>(() => {
    return boxConfig.imageSourceMode || 'all';
  });

  const [selectedImageIndices, setSelectedImageIndices] = useState<number[]>(() => {
    if (Array.isArray(boxConfig.selectedImageIndices) && boxConfig.selectedImageIndices.length > 0) {
      return boxConfig.selectedImageIndices;
    }
    return receivedImages.length > 0 ? receivedImages.map((_, i) => i + 1) : [1];
  });

  const [selectedUpstreamGroupId, setSelectedUpstreamGroupId] = useState<string>(() => {
    return boxConfig.selectedUpstreamGroupId || (propertyContext?.upstreamTabGroups?.[0]?.id || '');
  });

  const [promptSourceMode, setPromptSourceMode] = useState<'upstream_ai' | 'preset' | 'custom'>(() => {
    if (boxConfig.promptSourceMode) return boxConfig.promptSourceMode;
    if (isHeroNode && propertyContext?.upstreamPrompts && propertyContext.upstreamPrompts.length > 0) {
      return 'upstream_ai';
    }
    if (isHeroNode) return 'custom';
    return 'preset';
  });

  const [selectedUpstreamAiId, setSelectedUpstreamAiId] = useState<string>(() => {
    if (boxConfig.selectedUpstreamAiId) return boxConfig.selectedUpstreamAiId;
    // 1. Direct match by node keyword (e.g. 'tiktok', 'hero', 'content')
    const nodeKw = (boxConfig.title || '').toLowerCase();
    if (nodeKw && propertyContext?.upstreamPrompts && propertyContext.upstreamPrompts.length > 0) {
      const words = nodeKw.split(/[-_\s]+/).filter((w: string) => w.length > 2);
      const kwMatch = propertyContext.upstreamPrompts.find((p) => {
        const pt = p.title.toLowerCase();
        return words.some((w: string) => pt.includes(w));
      });
      if (kwMatch) return kwMatch.id;
    }
    // 2. Pick the first upstream prompt (which is sorted with directly wired connections first)
    return propertyContext?.upstreamPrompts?.[0]?.id || '';
  });

  const [tabGroupMode, setTabGroupMode] = useState<'generate' | 'enhance'>(currentTabGroupMode);

  // 3 Distinct Kinds of Tab Processes:
  // 1. 'generate_image': Reference Image + Images for Generate (Condo 1,2,3) + Prompt
  // 2. 'enhance_images': Image(s) + Prompt
  // 3. 'create_prompt': Template + Template Fill Value (Raw Data)
  const isCreatePromptNode = Boolean(
    boxConfig.title?.toLowerCase().includes('prompt') ||
    boxConfig.browserGroupName?.toLowerCase().includes('prompt')
  );

  const [processKind, setProcessKind] = useState<'generate_image' | 'enhance_images' | 'create_prompt'>(() => {
    if (isHeroNode) return 'generate_image';
    if (isEnhanceNode) return 'enhance_images';
    if (boxConfig.processKind) return boxConfig.processKind;
    if (isCreatePromptNode) return 'create_prompt';
    return 'enhance_images';
  });

  const [isChoosingFolder, setIsChoosingFolder] = useState(false);

  const handleChooseFolder = async () => {
    setIsChoosingFolder(true);
    try {
      const resp = await fetch('http://127.0.0.1:9224/choose-folder');
      const data = await resp.json();
      if (data && data.status === 'success' && data.folder_path) {
        localStorage.setItem('bolthaven_condo_target_folder', data.folder_path);
        updateMultiConfig({ targetFolder: data.folder_path });
        handleScanCondo(condoSearchQuery, data.folder_path);
      }
    } catch (e) {
      console.warn('Error choosing folder from companion:', e);
    } finally {
      setIsChoosingFolder(false);
    }
  };

  const [referenceImageMode, setReferenceImageMode] = useState<'photo_1' | 'picked' | 'custom_upload' | 'condo_scan'>(() => {
    return boxConfig.referenceImageMode || 'photo_1';
  });

  const [selectedReferenceIndex, setSelectedReferenceIndex] = useState<number>(() => {
    return boxConfig.selectedReferenceIndex || 1;
  });

  // Dynamic Pipeline Customization State
  const [useReferenceImage, setUseReferenceImage] = useState<boolean>(() => {
    return boxConfig.useReferenceImage !== undefined ? boxConfig.useReferenceImage !== false : true;
  });
  const [useCondoImages, setUseCondoImages] = useState<boolean>(() => {
    return boxConfig.useCondoImages !== undefined ? boxConfig.useCondoImages !== false : true;
  });
  const [condoImagesCount, setCondoImagesCount] = useState<number>(() => {
    return boxConfig.condoImagesCount !== undefined ? boxConfig.condoImagesCount : 3;
  });

  const [attachmentSteps, setAttachmentSteps] = useState<AttachmentStep[]>(() => {
    if (Array.isArray(boxConfig.imageAttachmentSteps) && boxConfig.imageAttachmentSteps.length > 0) {
      return boxConfig.imageAttachmentSteps;
    }
    const initialCondo = (
      boxConfig.browserCondoName ||
      boxConfig.condoFolderName ||
      ''
    ).trim();
    return [
      {
        id: 'group-1',
        title: 'Group 1',
        count: 3,
        sourceType: 'folder',
        folderName: initialCondo,
        enabled: true,
      },
    ];
  });

  useEffect(() => {
    if (Array.isArray(boxConfig.imageAttachmentSteps) && boxConfig.imageAttachmentSteps.length > 0) {
      setAttachmentSteps((prev) => {
        return boxConfig.imageAttachmentSteps.map((incoming: AttachmentStep) => {
          const existing = prev.find((p) => p.id === incoming.id);
          return {
            ...incoming,
            folderImages: existing?.folderImages || incoming.folderImages,
          };
        });
      });
    }
  }, [boxConfig.imageAttachmentSteps]);

  const handleAttachmentStepsChange = (newSteps: AttachmentStep[]) => {
    setAttachmentSteps(newSteps);
    const total = newSteps.filter((s: AttachmentStep) => s.enabled).reduce((acc: number, s: AttachmentStep) => acc + s.count, 0);
    // Sanitize steps so massive base64 folderImages is never persisted to backend workflow_config.json
    const sanitizedSteps = newSteps.map((s: AttachmentStep) => {
      const { folderImages: _omitted, ...rest } = s;
      return rest;
    });
    updateMultiConfig({
      imageAttachmentSteps: sanitizedSteps,
      condoImagesCount: total,
    });
  };
  const [useEnhancedImages, setUseEnhancedImages] = useState<boolean>(() => {
    return boxConfig.useEnhancedImages === true;
  });
  const [enhancedImagesSource, setEnhancedImagesSource] = useState<'enhanced' | 'get_images'>(() => {
    return boxConfig.enhancedImagesSource || 'enhanced';
  });
  const [enhancedImagesCount, setEnhancedImagesCount] = useState<number>(() => {
    return boxConfig.enhancedImagesCount !== undefined ? boxConfig.enhancedImagesCount : 5;
  });

  // 5. Output Dimension State
  const [outputWidth, setOutputWidth] = useState<number>(() => boxConfig.outputWidth || 1080);
  const [outputHeight, setOutputHeight] = useState<number>(() => boxConfig.outputHeight || 1350);
  const [strictPreservation, setStrictPreservation] = useState<boolean>(
    () => boxConfig.strictPreservationActive !== false
  );
  const [isOpeningProfile, setIsOpeningProfile] = useState<boolean>(false);
  const [isOpeningTab, setIsOpeningTab] = useState<boolean>(false);

  // Profile creation / discovery state
  const [isAddProfileOpen, setIsAddProfileOpen] = useState(false);
  const [isSyncingProfiles, setIsSyncingProfiles] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [newProfileDisplayName, setNewProfileDisplayName] = useState('');
  const [newProfileKey, setNewProfileKey] = useState('');
  const [newProfileEmail, setNewProfileEmail] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [saveProfileError, setSaveProfileError] = useState<string | null>(null);

  // Multi-tab Automated Workflow State
  const [isAutomating, setIsAutomating] = useState<boolean>(false);
  const [automationStatus, setAutomationStatus] = useState<AutomationStatusResponse | null>(null);
  const [automationMessage, setAutomationMessage] = useState<string | null>(null);

  // ── Auto-Run State & Preferences (Disabled on sidebar open — only runs via Workflow Run or explicit button click) ──
  const [autoRunEnabled, setAutoRunEnabled] = useState<boolean>(() => {
    if (typeof boxConfig.autoRun === 'boolean') return boxConfig.autoRun;
    return false;
  });
  const hasAutoStartedRef = useRef<boolean>(false);
  const autoRunTimerRef = useRef<any>(null);
  const twoStageIntervalRef = useRef<any>(null);
  const isSidebarStoppedRef = useRef<boolean>(false);
  const [autoRunCountdown, setAutoRunCountdown] = useState<number | null>(null);

  const handleToggleAutoRun = (val: boolean) => {
    setAutoRunEnabled(val);
    localStorage.setItem('bolthaven_browser_auto_run', String(val));
    updateMultiConfig({ autoRun: val });
    if (!val && autoRunTimerRef.current) {
      clearTimeout(autoRunTimerRef.current);
      autoRunTimerRef.current = null;
      setAutoRunCountdown(null);
      setAutomationMessage('Auto-run disabled.');
      setTimeout(() => setAutomationMessage(null), 2500);
    }
  };

  const handleCancelAutoRun = () => {
    if (autoRunTimerRef.current) {
      clearTimeout(autoRunTimerRef.current);
      autoRunTimerRef.current = null;
    }
    hasAutoStartedRef.current = true;
    setAutoRunCountdown(null);
    setAutomationMessage('Auto-run paused. Click Run whenever you are ready.');
    setTimeout(() => setAutomationMessage(null), 3000);
  };

  // 6. Two-Stage Tab Group Staging & Local Condo Building Image State
  const latestBoxConfigRef = useRef(boxConfig);
  latestBoxConfigRef.current = boxConfig;

  const [referenceImage, setReferenceImage] = useState<string>(
    () => boxConfig.referenceImage || getPersistedReferenceImage(boxConfig.id) || ''
  );
  const [condoSearchQuery, setCondoSearchQuery] = useState<string>(
    () =>
      aiExtractedCondoName ||
      (propertyContext?.title && propertyContext.title !== 'Featured Property Listing' && propertyContext.title !== 'Facebook Property Post'
        ? propertyContext.title
        : '') ||
      boxConfig.browserCondoName ||
      ''
  );
  const [matchedCondoInfo, setMatchedCondoInfo] = useState<any>(null);
  const [indexedCondoFolders, setIndexedCondoFolders] = useState<string[]>([]);
  const [isScanningCondo, setIsScanningCondo] = useState<boolean>(false);
  const [showFolderPicker, setShowFolderPicker] = useState<boolean>(false);
  const [isOpeningFinder, setIsOpeningFinder] = useState<boolean>(false);
  const [finderFeedback, setFinderFeedback] = useState<string | null>(null);
  const [isBrowsingFolder, setIsBrowsingFolder] = useState<boolean>(false);
  const [twoStageStatus, setTwoStageStatus] = useState<any>(null);
  const [isRunningTwoStage, setIsRunningTwoStage] = useState<boolean>(false);
  const [twoStageMessage, setTwoStageMessage] = useState<string | null>(null);
  const [isReloadingCondoName, setIsReloadingCondoName] = useState<boolean>(false);
  const [activeCondoSlot, setActiveCondoSlot] = useState<number | null>(null);
  const lastScannedKeyRef = useRef<string>('');
  const isScanningRef = useRef<boolean>(false);

  // Current 3 condo slots (array of length 3, each item is image object or null)
  const condoSlots = useMemo(() => {
    const slots: any[] = [null, null, null];
    const currentImgs = (matchedCondoInfo?.images && matchedCondoInfo.images.length > 0)
      ? matchedCondoInfo.images
      : (Array.isArray(boxConfig.condoImages) && boxConfig.condoImages.length > 0)
        ? boxConfig.condoImages
        : [];
    currentImgs.forEach((img: any, i: number) => {
      const targetIdx =
        typeof img.index === 'number' && img.index >= 1 && img.index <= 3
          ? img.index - 1
          : i < 3
            ? i
            : -1;
      if (targetIdx >= 0 && targetIdx < 3 && !slots[targetIdx]) {
        slots[targetIdx] = img;
      }
    });
    // Fallback: fill any unassigned slots sequentially from remaining images
    let nextIdx = 0;
    currentImgs.forEach((img: any) => {
      if (!slots.includes(img)) {
        while (nextIdx < 3 && slots[nextIdx] !== null) nextIdx++;
        if (nextIdx < 3) slots[nextIdx] = img;
      }
    });
    return slots;
  }, [matchedCondoInfo?.images, boxConfig.condoImages]);

  const selectedCondoCount = condoSlots.filter(Boolean).length;

  const availableEnhancedPhotos = useMemo(() => {
    if (enhancedImages && enhancedImages.length > 0) {
      return enhancedImages.map((img, i) => ({
        url: img.url,
        full_path: (img as any).full_path,
        index: img.position || i + 1,
        filename: img.filename || `Enhanced Photo #${img.position || i + 1}`,
      }));
    }
    if (propertyContext?.enhancedImages && propertyContext.enhancedImages.length > 0) {
      return propertyContext.enhancedImages;
    }
    return [];
  }, [enhancedImages, propertyContext?.enhancedImages]);

  const effectiveWorkflowImageSources = useMemo<WorkflowImageSource[]>(() => {
    return (workflowImageSources || []).map((src) => {
      const isEnhance = src.nodeType === 'enhance' || src.title?.toLowerCase().includes('enhance') || src.id?.includes('enhance');
      if (isEnhance) {
        const enh = (src.images && src.images.length > 0)
          ? src.images
          : (availableEnhancedPhotos.length > 0 ? availableEnhancedPhotos : []);
        return {
          ...src,
          images: enh,
          count: enh.length,
          description: enh.length > 0 ? `${enh.length} enhanced photos` : '0 enhanced photos (awaiting results)',
        };
      }
      return src;
    });
  }, [workflowImageSources, availableEnhancedPhotos]);

  const availableSourcePhotos = useMemo(() => {
    return receivedImages;
  }, [receivedImages]);

  // Set or replace a slot with an image (ensures exactly 3 slots max)
  const handleAssignCondoSlot = (imageObj: any, preferredSlotIndex?: number) => {
    const updated = [...condoSlots];
    let slotToUse =
      typeof preferredSlotIndex === 'number' && preferredSlotIndex >= 0 && preferredSlotIndex < 3
        ? preferredSlotIndex
        : activeCondoSlot !== null
          ? activeCondoSlot
          : -1;

    // If no preferred slot, find first empty slot
    if (slotToUse === -1) {
      slotToUse = updated.findIndex((s) => s === null);
      if (slotToUse === -1) slotToUse = 0; // if all 3 full, replace first slot
    }

    // Check if this image is already in another slot, if so swap or remove it from that slot
    const existingSlotIdx = updated.findIndex(
      (s) =>
        s &&
        (s.full_path === imageObj.full_path ||
          s.filename === imageObj.filename ||
          (s.data_url && imageObj.data_url && s.data_url === imageObj.data_url))
    );
    if (existingSlotIdx !== -1 && existingSlotIdx !== slotToUse) {
      updated[existingSlotIdx] = null;
    }

    updated[slotToUse] = {
      ...imageObj,
      index: slotToUse + 1,
    };

    const cleanList = updated.filter(Boolean).map((img, i) => ({
      ...img,
      index: i + 1,
    }));

    const newInfo = {
      ...matchedCondoInfo,
      images: updated.map((img, i) => (img ? { ...img, index: i + 1 } : null)).filter(Boolean),
      images_found: cleanList.length,
    };
    setMatchedCondoInfo(newInfo);
    updateMultiConfig({
      browserCondoImagesCount: cleanList.length,
      condoImages: cleanList,
    });
  };

  // Remove photo from a slot
  const handleRemoveCondoSlot = (slotIndex: number) => {
    const updated = [...condoSlots];
    updated[slotIndex] = null;
    const cleanList = updated.filter(Boolean).map((img, i) => ({
      ...img,
      index: i + 1,
    }));
    const newInfo = {
      ...matchedCondoInfo,
      images: cleanList,
      images_found: cleanList.length,
    };
    setMatchedCondoInfo(newInfo);
    updateMultiConfig({
      browserCondoImagesCount: cleanList.length,
      condoImages: cleanList,
    });
  };

  // Upload custom file for a condo slot
  const handleUploadCondoPhoto = (e: React.ChangeEvent<HTMLInputElement>, slotIndex?: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const customImg = {
        index: (slotIndex !== undefined ? slotIndex : 0) + 1,
        filename: file.name,
        mime_type: file.type || 'image/png',
        full_path: file.name,
        size_bytes: file.size,
        data_url: dataUrl,
      };
      handleAssignCondoSlot(customImg, slotIndex);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleReloadCondoName = async () => {
    setIsReloadingCondoName(true);
    try {
      let extractedName = '';
      if (onRunCondoNameStep) {
        const res = await onRunCondoNameStep();
        if (res && typeof res === 'string') {
          extractedName = extractCleanCondoNameFromAiText(res);
        }
      }
      if (!extractedName && (rawPostContent || propertyContext?.title)) {
        const textSrc = rawPostContent || propertyContext?.title || '';
        if (textSrc.trim()) {
          const resp = await fetch('/api/facebook-import/ai-process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              provider: 'google_ai',
              model: 'gemini-1.5-flash',
              template_name: 'Get Condo Name',
              template_text: 'Extract the condominium or residential project name from the provided text and also translate that name to english.\n\nSTRICT RULES:\n- Return ONLY the condominium or project name.\n\nOUTPUT EXAMPLE:\nRegent Home Bangna\n\nTEXT TO ANALYZE:\n{{CONTENT}}',
              raw_content: textSrc,
            }),
          });
          const data = await resp.json();
          if (data?.success && data?.generated_content) {
            extractedName = extractCleanCondoNameFromAiText(data.generated_content);
          }
        }
      }
      if (extractedName && extractedName !== 'NOT_FOUND') {
        lastScannedKeyRef.current = '';
        setCondoSearchQuery(extractedName);
        updateMultiConfig({
          browserCondoName: extractedName,
        });
        await handleScanCondo(extractedName);
      }
    } catch (err) {
      console.error('Error reloading condo name:', err);
    } finally {
      setIsReloadingCondoName(false);
    }
  };

  const effectiveListingCode = useMemo(() => {
    return (propertyContext?.listingCode || (() => {
      try {
        return localStorage.getItem('bolthaven_active_session_listing_code') || '';
      } catch {
        return '';
      }
    })() || '').trim();
  }, [propertyContext?.listingCode]);

  const heroPreviewId = useMemo(() => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return `${code}_${Date.now()}`;
  }, [boxConfig.id, effectiveListingCode, condoName]);

  const [copiedHeroPath, setCopiedHeroPath] = useState(false);
  const [previewModalImage, setPreviewModalImage] = useState<{
    url: string;
    title?: string;
    fileName?: string;
    filePath?: string;
    condoName?: string;
  } | null>(null);

  useEffect(() => {
    if (!previewModalImage) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewModalImage(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewModalImage]);
  const [latestHeroImage, setLatestHeroImage] = useState<{
    url: string;
    fileName?: string;
    filePath?: string;
    condoName?: string;
    createdAt?: string;
    nodeId?: string;
    groupName?: string;
  } | null>(() => {
    try {
      // 1. Check node-specific storage first
      const nodeSaved = localStorage.getItem(`bolthaven_hero_image_${boxConfig.id}`);
      if (nodeSaved) {
        const parsedNode = JSON.parse(nodeSaved);
        if (isImageRelevantToThisNode(parsedNode, boxConfig, targetGroupName)) {
          return parsedNode;
        } else {
          localStorage.removeItem(`bolthaven_hero_image_${boxConfig.id}`);
        }
      }

      // 2. Fall back to bolthaven_last_hero_image ONLY if strictly relevant to this node (never for TikTok nodes!)
      const boxTitleLower = (boxConfig.title || '').toLowerCase();
      const isTikTok = boxTitleLower.includes('tiktok') || (targetGroupName || '').toLowerCase().includes('tiktok');
      if (isTikTok) return null;

      const saved = localStorage.getItem('bolthaven_last_hero_image');
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      if (!isImageRelevantToThisNode(parsed, boxConfig, targetGroupName)) {
        return null;
      }
      const fileNameLower = (parsed?.fileName || '').toLowerCase();
      if (!fileNameLower.includes('hero')) {
        return null;
      }
      const activeCondo = (aiExtractedCondoName || propertyContext?.title || boxConfig.browserCondoName || '').trim();
      const normActive = activeCondo.toLowerCase().replace(/[^a-z0-9]/g, '');
      const normFile = fileNameLower.replace(/[^a-z0-9]/g, '');
      const normParsed = (parsed?.condoName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (
        !normActive ||
        normActive === 'featuredpropertylisting' ||
        normActive === 'facebookpropertypost' ||
        (normParsed && (normActive.includes(normParsed) || normParsed.includes(normActive))) ||
        (normFile && normFile.includes(normActive))
      ) {
        return parsed;
      }
      return null;
    } catch (e) {
      return null;
    }
  });

  const updateLatestHeroImage = (img: any) => {
    setLatestHeroImage(img);
    try {
      if (img) {
        const safeUrl =
          typeof img.url === 'string' && img.url.startsWith('data:') && img.url.length > 200000 && img.fileName
            ? `http://127.0.0.1:9224/hero-downloaded-image?file=${encodeURIComponent(img.fileName)}`
            : img.url;
        const payload = { ...img, url: safeUrl, nodeId: boxConfig.id, groupName: targetGroupName };
        localStorage.setItem(`bolthaven_hero_image_${boxConfig.id}`, JSON.stringify(payload));
        // Only update global bolthaven_last_hero_image if relevant to FB Hero
        if (isImageRelevantToThisNode(img, { title: 'Facebook Hero IMG', browserGroupName: 'FB Hero' } as any, 'FB Hero')) {
          localStorage.setItem('bolthaven_last_hero_image', JSON.stringify(payload));
        }
      } else {
        localStorage.removeItem(`bolthaven_hero_image_${boxConfig.id}`);
      }
    } catch (e) { }
    try {
      window.dispatchEvent(new CustomEvent('ea_hero_image_updated', { detail: img }));
    } catch (_) { }
  };

  // Auto-fetch latest downloaded Hero image on mount or when sidebar is opened
  useEffect(() => {
    if (!isHeroNode) return;
    let isCancelled = false;
    const fetchLatestStatus = async () => {
      try {
        const queryCondo = (condoName || condoSearchQuery || '').trim();
        const effCode = propertyContext?.listingCode || (() => {
          try { return localStorage.getItem('bolthaven_active_session_listing_code') || ''; } catch { return ''; }
        })();
        const params = new URLSearchParams();
        if (boxConfig.id) params.set('node_id', boxConfig.id);
        if (targetGroupName) params.set('group', targetGroupName);
        if (queryCondo) params.set('condo', queryCondo);
        if (effCode) params.set('listing_code', effCode);
        const url = `http://127.0.0.1:9224/two-stage-status?${params.toString()}`;
        const resp = await fetch(url);
        if (resp.ok && !isCancelled) {
          const data = await resp.json();
          if (data?.state) {
            setTwoStageStatus(data.state);
            const activeRunning =
              Boolean(data.state.is_running) &&
              data.state.step !== 'completed' &&
              data.state.step !== 'stopped' &&
              data.state.step !== 'error';
            setIsRunningTwoStage(activeRunning);
            if (activeRunning && data.state.message) {
              setTwoStageMessage(data.state.message);
            }
            if (data.state.downloaded_image_url || data.state.downloaded_file) {
              const file = data.state.downloaded_file || '';
              const fileLower = file.toLowerCase();
              if (!fileLower.includes('hero')) {
                return;
              }
              if (effCode && !fileLower.includes(effCode.toLowerCase())) {
                return; // Belong to another listing code
              }
              // STRICTLY verify relevance to THIS specific node!
              const stateGroupLow = (data.state.group_name || '').toLowerCase();
              const targetGroupLow = (targetGroupName || '').toLowerCase();
              const sameGroup = Boolean(stateGroupLow && targetGroupLow && (stateGroupLow === targetGroupLow || stateGroupLow.includes(targetGroupLow) || targetGroupLow.includes(stateGroupLow)));
              const candidate = {
                fileName: file,
                condoName: data.state.condo_name,
                nodeId: sameGroup ? boxConfig.id : data.state.node_id,
                groupName: data.state.group_name,
              };
              if (!isImageRelevantToThisNode(candidate, boxConfig, targetGroupName)) {
                return; // Ignore conflicting images from other nodes/generators!
              }
              const stateCondo = (data.state.condo_name || '').trim();
              const normQuery = queryCondo.toLowerCase().replace(/[^a-z0-9]/g, '');
              const normFile = fileLower.replace(/[^a-z0-9]/g, '');
              const normState = stateCondo.toLowerCase().replace(/[^a-z0-9]/g, '');

              const condoMatches = !normQuery ||
                normQuery === 'featuredpropertylisting' ||
                normQuery === 'facebookpropertypost' ||
                (normState && (normState.includes(normQuery) || normQuery.includes(normState))) ||
                (normFile && normFile.includes(normQuery));

              if (condoMatches) {
                const imgUrl = data.state.downloaded_image_url || `http://127.0.0.1:9224/hero-downloaded-image?file=${encodeURIComponent(file)}`;
                try {
                  if (!localStorage.getItem('bolthaven_active_session_listing_code')) {
                    const codeMatch = file.match(/^([A-Z]{2,5}-\d{4,8}-[A-Z]{2})_/i);
                    if (codeMatch?.[1]) {
                      localStorage.setItem('bolthaven_active_session_listing_code', codeMatch[1].toUpperCase());
                    }
                  }
                } catch {}
                updateLatestHeroImage({
                  url: imgUrl,
                  fileName: file,
                  filePath: data.state.downloaded_file_path || '',
                  condoName: stateCondo || queryCondo,
                  createdAt: data.state.updated_at,
                  nodeId: boxConfig.id,
                  groupName: targetGroupName,
                });
              }
            }
          }
        }
      } catch (e) { }
    };
    fetchLatestStatus();
    const interval = setInterval(fetchLatestStatus, 2500);
    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [isHeroNode, condoName, condoSearchQuery, boxConfig.id, boxConfig.title, targetGroupName]);

  // Restore persisted reference image on mount or box change (and keep it until changed or deleted)
  useEffect(() => {
    let cancelled = false;
    if (boxConfig.referenceImage) {
      savePersistedReferenceImage(boxConfig.referenceImage, boxConfig.id);
      setReferenceImage(boxConfig.referenceImage);
      setReferenceImageMode('custom_upload');
      return;
    }
    loadPersistedReferenceImageAsync(boxConfig.id).then((persisted) => {
      if (cancelled || !persisted) return;
      setReferenceImage(persisted);
      setReferenceImageMode('custom_upload');
      updateMultiConfig({
        referenceImage: persisted,
        useReferenceImage: true,
        referenceImageMode: 'custom_upload',
      });
    });
    return () => {
      cancelled = true;
    };
  }, [boxConfig.id]);

  useEffect(() => {
    if (typeof boxConfig.autoRun === 'boolean') {
      setAutoRunEnabled(boxConfig.autoRun);
    }
    if (boxConfig.imageSourceMode) {
      setImageSourceMode(boxConfig.imageSourceMode);
    }
    if (Array.isArray(boxConfig.selectedImageIndices) && boxConfig.selectedImageIndices.length > 0) {
      setSelectedImageIndices(boxConfig.selectedImageIndices);
    }
  }, [boxConfig.id, boxConfig.autoRun, boxConfig.imageSourceMode, boxConfig.selectedImageIndices]);

  // When imageSourceMode is 'all' (default), automatically select all received images from Get Images
  useEffect(() => {
    if (imageSourceMode === 'all' && receivedImages.length > 0) {
      const allIdx = receivedImages.map((img, i) =>
        typeof img.index === 'number' && img.index > 0 ? img.index : i + 1
      );
      setSelectedImageIndices(allIdx);
    }
  }, [receivedImages, imageSourceMode]);

  // Fetch all available condo subfolders in the target directory
  const fetchCondoFolderList = async (folderToUse?: string) => {
    const baseDir =
      folderToUse !== undefined
        ? folderToUse
        : boxConfig.targetFolder || localStorage.getItem('bolthaven_condo_target_folder') || '';
    try {
      const resp = await fetch(
        `http://127.0.0.1:9224/condo-folders?base_dir=${encodeURIComponent(baseDir)}`
      );
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.status === 'success' && Array.isArray(data.folders)) {
          setIndexedCondoFolders(data.folders);
        }
      }
    } catch {
      // ignore if companion offline
    }
  };

  // Scan condo directory from local Mac companion (Strictly Read-Only!)
  const handleScanCondo = async (queryToSearch?: string, folderToUse?: string) => {
    const q = (queryToSearch !== undefined ? queryToSearch : condoSearchQuery)?.trim();
    let baseDir = folderToUse !== undefined ? folderToUse : (boxConfig.targetFolder || localStorage.getItem('bolthaven_condo_target_folder') || '');
    if (baseDir && baseDir.includes('/Condo Building/') && !baseDir.endsWith('/Condo Building')) {
      baseDir = baseDir.substring(0, baseDir.indexOf('/Condo Building') + '/Condo Building'.length);
    }
    if (baseDir.endsWith('/Desktop')) {
      baseDir = '/Users/zinwaishine/Desktop/Condo Building';
    }
    if (!q || isScanningRef.current) return;

    const scanKey = `${q}::${baseDir}`;
    if (lastScannedKeyRef.current === scanKey && matchedCondoInfo) {
      return;
    }
    lastScannedKeyRef.current = scanKey;

    isScanningRef.current = true;
    setIsScanningCondo(true);
    try {
      const resp = await fetch(
        `http://127.0.0.1:9224/condo-images?condo_name=${encodeURIComponent(q)}&base_dir=${encodeURIComponent(baseDir)}`
      );
      const data = await resp.json();
      if (data && data.status === 'success') {
        setMatchedCondoInfo(data);
        if (
          boxConfig.browserMatchedFolder !== data.matched_folder ||
          boxConfig.browserCondoImagesCount !== data.images_found ||
          boxConfig.browserCondoName !== q
        ) {
          updateMultiConfig({
            browserCondoName: q,
            browserMatchedFolder: data.matched_folder,
            browserCondoImagesCount: data.images_found,
            condoImages: data.images || [],
          });
        }
      } else {
        setMatchedCondoInfo(null);
      }
    } catch (e) {
      console.warn('Error querying condo images from companion:', e);
      setMatchedCondoInfo(null);
    } finally {
      isScanningRef.current = false;
      setIsScanningCondo(false);
    }
  };

  // Open currently matched condo folder directly in macOS Finder
  const handleOpenFolderInFinder = async () => {
    const folderPath =
      matchedCondoInfo?.folder_path ||
      boxConfig.targetFolder ||
      localStorage.getItem('bolthaven_condo_target_folder') ||
      '/Users/zinwaishine/Desktop/Condo Building';
    setIsOpeningFinder(true);
    try {
      const resp = await fetch(
        `http://127.0.0.1:9224/open-folder?folder=${encodeURIComponent(folderPath)}`
      );
      const data = await resp.json();
      if (data?.status === 'ok') {
        setFinderFeedback('Opened');
        setTimeout(() => setFinderFeedback(null), 2500);
      }
    } catch (err) {
      console.warn('Failed to open folder in Finder:', err);
    } finally {
      setIsOpeningFinder(false);
    }
  };

  const sortEnhancedByCustomOrder = <T extends { filename?: string; position?: number }>(
    list: T[],
    customOrderRaw?: unknown
  ): { sorted: T[]; hasCustomOrder: boolean } => {
    const customOrder = Array.isArray(customOrderRaw) ? (customOrderRaw as string[]) : [];
    if (customOrder.length === 0) {
      return { sorted: list, hasCustomOrder: false };
    }
    const sorted = [...list].sort((a, b) => {
      const ka = a.filename || String(a.position || '');
      const kb = b.filename || String(b.position || '');
      const ia = customOrder.indexOf(ka);
      const ib = customOrder.indexOf(kb);
      if (ia === -1 && ib === -1) return (a.position || 0) - (b.position || 0);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    return { sorted, hasCustomOrder: true };
  };

  const buildEnhancedPhotoMap = (
    list: Array<{ position?: number; backend_url?: string; url: string }>,
    hasCustomOrder: boolean
  ): Record<number, string> => {
    const map: Record<number, string> = {};
    list.forEach((img, idx) => {
      const key = hasCustomOrder ? idx : ((img.position || 1) - 1);
      map[key] = img.url || img.backend_url || '';
    });
    return map;
  };

  // Re-get and sync all enhanced images from local drive / downloads
  const handleRegetEnhancedImages = async () => {
    setIsRegettingImages(true);
    try {
      // 1. Trigger companion to re-scan persistent folders & downloads
      try {
        await fetch('http://127.0.0.1:9224/recover-missing-images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            property_id: propertyContext?.id || '',
            propertyId: propertyContext?.id || '',
            listing_code: (propertyContext?.listingCode || '').trim(),
            listingCode: (propertyContext?.listingCode || '').trim(),
            autoWorkMissing: false,
          }),
        });
      } catch (e) { }

      await new Promise((r) => setTimeout(r, 600));

      // 2. Query fresh enhanced images from disk/companion
      const freshList = await fetchEnhancedDownloadedImages(propertyContext?.id, propertyContext?.listingCode);
      const newTs = Date.now();
      setCacheBustTimestamp(newTs);
      if (freshList && freshList.length > 0) {
        const valid = freshList.filter((img) => (img.position || 1) <= (receivedImages.length || 99));
        if (valid.length > 0) {
          // Guarantee fresh URLs with timestamp for immediate browser re-rendering
          const cacheBusted = valid.map((img) => ({
            ...img,
            url: img.url.includes('?') ? `${img.url}&_cb=${newTs}` : `${img.url}?_cb=${newTs}`,
          }));
          const { sorted, hasCustomOrder } = sortEnhancedByCustomOrder(
            cacheBusted,
            (boxConfig as any).enhancedImagesOrder
          );
          lastEnhancedSigRef.current = sorted
            .map((img) => `${img.position}:${img.backend_url || img.url}:${(img as any).size_bytes || (img as any).size || ''}`)
            .join('|');
          setEnhancedImages(sorted);
          if (onEnhancedPhotosUpdate) {
            onEnhancedPhotosUpdate(buildEnhancedPhotoMap(sorted, hasCustomOrder));
          }
        }
      }
      loadQueue();
      setRegetFeedback('Re-synced');
      setTimeout(() => setRegetFeedback(null), 2500);
    } catch (err) {
      console.warn('Failed to re-get enhanced images:', err);
    } finally {
      setIsRegettingImages(false);
    }
  };

  // Re-get / re-sync a single enhanced image position
  const handleRegetSingleImage = async (position: number) => {
    setRegettingSinglePos(position);
    try {
      await fetch('http://127.0.0.1:9224/recover-missing-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: propertyContext?.id || '',
          propertyId: propertyContext?.id || '',
          listing_code: (propertyContext?.listingCode || '').trim(),
          listingCode: (propertyContext?.listingCode || '').trim(),
          targetPositions: [position],
          autoWorkMissing: false,
        }),
      });
      for (let i = 0; i < 4; i++) {
        await new Promise((r) => setTimeout(r, 800));
        const freshList = await fetchEnhancedDownloadedImages(propertyContext?.id, propertyContext?.listingCode);
        if (freshList && freshList.length > 0) {
          const valid = freshList.filter((img) => (img.position || 1) <= (receivedImages.length || 99));
          if (valid.some((img) => img.position === position)) {
            const newTs = Date.now();
            setCacheBustTimestamp(newTs);
            const cacheBusted = valid.map((img) => ({
              ...img,
              url: img.url.includes('?') ? `${img.url}&_cb=${newTs}` : `${img.url}?_cb=${newTs}`,
            }));
            const { sorted, hasCustomOrder } = sortEnhancedByCustomOrder(
              cacheBusted,
              (boxConfig as any).enhancedImagesOrder
            );
            lastEnhancedSigRef.current = sorted
              .map((img) => `${img.position}:${img.backend_url || img.url}:${(img as any).size_bytes || (img as any).size || ''}`)
              .join('|');
            setEnhancedImages(sorted);
            if (onEnhancedPhotosUpdate) {
              onEnhancedPhotosUpdate(buildEnhancedPhotoMap(sorted, hasCustomOrder));
            }
            break;
          }
        }
      }
    } catch (e) {
      console.warn(`Failed to re-get image #${position}:`, e);
    } finally {
      setRegettingSinglePos(null);
    }
  };

  // Delete a single enhanced image from disk, cache, and state
  const handleDeleteEnhancedImage = async (img: EnhancedDownloadedImage) => {
    const pos = img.position || 1;
    setDeletingPos(pos);
    try {
      await fetch('http://127.0.0.1:9224/delete-enhanced-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: img.filename,
          position: pos,
          listing_code: (propertyContext?.listingCode || '').trim(),
        }),
      });
      // Remove from enhancedImages in state
      setEnhancedImages((prev) => prev.filter((item) => (item.position || 1) !== pos));
      if (onEnhancedPhotosUpdate) {
        onEnhancedPhotosUpdate({ [pos - 1]: '' });
      }
      setRegetFeedback('Deleted');
      setTimeout(() => setRegetFeedback(null), 2000);
    } catch (e) {
      console.warn(`Failed to delete image #${pos}:`, e);
    } finally {
      setDeletingPos(null);
    }
  };

  // Browse any folder on Mac directly via native folder chooser dialog
  const handleBrowseCustomFolder = async () => {
    setIsBrowsingFolder(true);
    try {
      const defaultDir =
        matchedCondoInfo?.folder_path ||
        boxConfig.targetFolder ||
        localStorage.getItem('bolthaven_condo_target_folder') ||
        '/Users/zinwaishine/Desktop/Condo Building';
      const resp = await fetch(
        `http://127.0.0.1:9224/choose-folder?default=${encodeURIComponent(defaultDir)}`
      );
      const data = await resp.json();
      if (data?.status === 'success' && data?.selected_path) {
        const selectedPath = data.selected_path;
        // Query photos directly for this chosen folder
        const folderResp = await fetch(
          `http://127.0.0.1:9224/condo-images?folder_path=${encodeURIComponent(selectedPath)}`
        );
        const folderData = await folderResp.json();
        if (folderData?.status === 'success') {
          setMatchedCondoInfo(folderData);
          const chosenName = folderData.matched_folder || selectedPath.split('/').pop() || '';
          setCondoSearchQuery(chosenName);
          updateMultiConfig({
            browserCondoName: chosenName,
            targetFolder: folderData.base_dir || selectedPath,
            browserMatchedFolder: folderData.matched_folder,
            browserCondoImagesCount: folderData.images_found,
          });
        } else {
          // If a base directory was chosen, reload the indexed folders
          fetchCondoFolderList(selectedPath);
          handleScanCondo(condoSearchQuery || condoName, selectedPath);
        }
      }
    } catch (err) {
      console.warn('Failed to browse folder on Mac:', err);
    } finally {
      setIsBrowsingFolder(false);
    }
  };

  // Select a condo folder manually from indexed folders or restore auto-match
  const handleSelectCondoFolder = (val: string) => {
    if (val === '__auto__') {
      const autoQuery =
        aiExtractedCondoName ||
        (propertyContext?.title &&
          propertyContext.title !== 'Featured Property Listing' &&
          propertyContext.title !== 'Facebook Property Post'
          ? propertyContext.title
          : '') ||
        condoName;
      setCondoSearchQuery(autoQuery);
      updateMultiConfig({ browserCondoName: autoQuery });
      handleScanCondo(autoQuery);
    } else {
      setCondoSearchQuery(val);
      updateMultiConfig({ browserCondoName: val });
      handleScanCondo(val);
    }
  };

  // Listen for global workflow cleared event (Clear Canvas Data & Results)
  useEffect(() => {
    const handleWorkflowCleared = () => {
      clearCondoFolderCache();
      setCondoSearchQuery('');
      setMatchedCondoInfo(null);
      lastScannedKeyRef.current = '';
      setEnhancedImages([]);
      setShowOrderModal(false);
      setOrderDraft([]);
      setQueueJobs([]);
      setAutomationStatus(null);
      setIsAutomating(false);
      setAutomationMessage(null);
      onEnhancedPhotosUpdate?.({});
      try {
        localStorage.removeItem('bolthaven_active_session_listing_code');
        localStorage.removeItem('bolthaven_active_listing_code');
      } catch { }
      setAttachmentSteps([
        {
          id: 'group-1',
          title: 'Group 1',
          count: 3,
          sourceType: 'folder',
          folderName: '',
          enabled: true,
        },
      ]);
      updateMultiConfig({
        browserCondoName: '',
        browserMatchedFolder: '',
        browserCondoImagesCount: 0,
        condoImages: [],
        imageAttachmentSteps: [],
        enhancedImagesOrder: undefined,
      });
    };
    window.addEventListener('ea_workflow_cleared', handleWorkflowCleared);
    return () => {
      window.removeEventListener('ea_workflow_cleared', handleWorkflowCleared);
    };
  }, [boxConfig?.id]);

  useEffect(() => {
    let folder = boxConfig.targetFolder || localStorage.getItem('bolthaven_condo_target_folder') || '/Users/zinwaishine/Desktop/Condo Building';
    if (folder.includes('/Condo Building') && !folder.endsWith('/Condo Building')) {
      folder = folder.substring(0, folder.indexOf('/Condo Building') + '/Condo Building'.length);
      localStorage.setItem('bolthaven_condo_target_folder', folder);
    }
    if (folder.endsWith('/Desktop')) {
      folder = '/Users/zinwaishine/Desktop/Condo Building';
      localStorage.setItem('bolthaven_condo_target_folder', folder);
    }
    fetchCondoFolderList(folder);
    const q =
      aiExtractedCondoName ||
      (propertyContext?.title &&
        propertyContext.title !== 'Featured Property Listing' &&
        propertyContext.title !== 'Facebook Property Post'
        ? propertyContext.title
        : '') ||
      boxConfig.browserCondoName ||
      condoName ||
      '';
    if (q) {
      setCondoSearchQuery(q);
      handleScanCondo(q, folder);
    } else {
      setCondoSearchQuery('');
      setMatchedCondoInfo(null);
      lastScannedKeyRef.current = '';
    }
  }, [aiExtractedCondoName, propertyContext?.title, boxConfig.targetFolder, boxConfig.browserCondoName, condoName]);

  // Synchronize state when boxConfig is updated from FBHeroSettingsSidebox
  useEffect(() => {
    if (boxConfig.referenceImage) {
      if (boxConfig.referenceImage !== referenceImage) {
        setReferenceImage(boxConfig.referenceImage);
        setReferenceImageMode('custom_upload');
      }
    } else if (boxConfig.referenceImage === '' || isReferenceImageExplicitlyDeleted()) {
      if (referenceImage !== '') {
        setReferenceImage('');
      }
    } else {
      const persisted = getPersistedReferenceImage(boxConfig.id);
      if (persisted && persisted !== referenceImage) {
        setReferenceImage(persisted);
        setReferenceImageMode('custom_upload');
      }
    }
  }, [boxConfig.referenceImage, boxConfig.id]);

  useEffect(() => {
    if (boxConfig.promptSourceMode && boxConfig.promptSourceMode !== promptSourceMode) {
      setPromptSourceMode(boxConfig.promptSourceMode);
    }
  }, [boxConfig.promptSourceMode]);

  useEffect(() => {
    if (boxConfig.selectedUpstreamAiId && boxConfig.selectedUpstreamAiId !== selectedUpstreamAiId) {
      setSelectedUpstreamAiId(boxConfig.selectedUpstreamAiId);
    } else if (!selectedUpstreamAiId && propertyContext?.upstreamPrompts && propertyContext.upstreamPrompts.length > 0) {
      setSelectedUpstreamAiId(propertyContext.upstreamPrompts[0].id);
    }
  }, [boxConfig.selectedUpstreamAiId, propertyContext?.upstreamPrompts]);

  useEffect(() => {
    if (boxConfig.browserCustomPrompt !== undefined && boxConfig.browserCustomPrompt !== customPromptText) {
      setCustomPromptText(boxConfig.browserCustomPrompt);
    }
  }, [boxConfig.browserCustomPrompt]);

  useEffect(() => {
    if (boxConfig.tabGroupMode && boxConfig.tabGroupMode !== tabGroupMode) {
      setTabGroupMode(boxConfig.tabGroupMode);
    }
  }, [boxConfig.tabGroupMode]);

  useEffect(() => {
    if (boxConfig.useReferenceImage !== undefined && boxConfig.useReferenceImage !== useReferenceImage) {
      setUseReferenceImage(boxConfig.useReferenceImage !== false);
    }
  }, [boxConfig.useReferenceImage]);

  useEffect(() => {
    if (boxConfig.useCondoImages !== undefined && boxConfig.useCondoImages !== useCondoImages) {
      setUseCondoImages(boxConfig.useCondoImages !== false);
    }
  }, [boxConfig.useCondoImages]);

  useEffect(() => {
    if (boxConfig.condoImagesCount !== undefined && boxConfig.condoImagesCount !== condoImagesCount) {
      setCondoImagesCount(boxConfig.condoImagesCount);
    }
  }, [boxConfig.condoImagesCount]);

  useEffect(() => {
    if (boxConfig.useEnhancedImages !== undefined && boxConfig.useEnhancedImages !== useEnhancedImages) {
      setUseEnhancedImages(boxConfig.useEnhancedImages);
    }
  }, [boxConfig.useEnhancedImages]);

  useEffect(() => {
    if (boxConfig.enhancedImagesSource && boxConfig.enhancedImagesSource !== enhancedImagesSource) {
      setEnhancedImagesSource(boxConfig.enhancedImagesSource);
    }
  }, [boxConfig.enhancedImagesSource]);

  useEffect(() => {
    if (boxConfig.enhancedImagesCount !== undefined && boxConfig.enhancedImagesCount !== enhancedImagesCount) {
      setEnhancedImagesCount(boxConfig.enhancedImagesCount);
    }
  }, [boxConfig.enhancedImagesCount]);

  const handleReferenceImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const rawDataUrl = event.target?.result as string;
      if (!rawDataUrl) return;
      const savedDataUrl = await savePersistedReferenceImage(rawDataUrl, boxConfig.id);
      setReferenceImage(savedDataUrl);
      setReferenceImageMode('custom_upload');
      updateMultiConfig({
        referenceImage: savedDataUrl,
        useReferenceImage: true,
        referenceImageMode: 'custom_upload',
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveReferenceImage = async () => {
    await clearPersistedReferenceImage(boxConfig.id);
    setReferenceImage('');
    setReferenceImageMode('photo_1');
    updateMultiConfig({
      referenceImage: '',
      referenceImageMode: 'photo_1',
    });
  };

  const handleRunTwoStageTest = async () => {
    if (boxConfig.enabled === false) {
      setTwoStageMessage('⚠️ This step is disabled. Enable Node Status above to run it.');
      return;
    }
    if (autoRunTimerRef.current) {
      clearTimeout(autoRunTimerRef.current);
      autoRunTimerRef.current = null;
    }
    if (twoStageIntervalRef.current) {
      clearInterval(twoStageIntervalRef.current);
      twoStageIntervalRef.current = null;
    }
    isSidebarStoppedRef.current = false;
    hasAutoStartedRef.current = true;
    setAutoRunCountdown(null);
    setIsRunningTwoStage(true);
    setTwoStageMessage('Initiating Two-Stage Staging via companion...');
    try {
      const activeProf = profiles.find((p) => p.id === selectedProfileId);
      const profKey = activeProf?.profile_key || boxConfig.browserProfileKey || (profiles[0]?.profile_key || 'Pro');

      // 1. Reference Photo (1st Attached)
      const shouldAttachRef = useReferenceImage && boxConfig.useReferenceImage !== false;
      const refImgToUse = shouldAttachRef
        ? (activeReferenceImage?.url || referenceImage || boxConfig.referenceImage || (propertyContext?.images && propertyContext.images[0]?.url) || null)
        : null;

      // 2. Condo / Attached Group Photos (2nd Attached)
      let condoImagesToUse: any[] = [];
      const shouldAttachCondo = useCondoImages && boxConfig.useCondoImages !== false;
      if (shouldAttachCondo) {
        const resolvedGroupPhotos = resolveAttachedPhotosFromSteps(
          attachmentSteps,
          effectiveWorkflowImageSources,
          propertyContext?.images,
          availableEnhancedPhotos
        );
        if (resolvedGroupPhotos.length > 0) {
          condoImagesToUse = resolvedGroupPhotos;
        } else {
          const targetCondoCount = typeof condoImagesCount === 'number' ? condoImagesCount : 3;
          const selectedCondoImgs = condoSlots.filter(Boolean);
          if (selectedCondoImgs.length > 0) {
            condoImagesToUse = selectedCondoImgs.slice(0, targetCondoCount);
          } else if (matchedCondoInfo?.images && matchedCondoInfo.images.length > 0) {
            condoImagesToUse = matchedCondoInfo.images.slice(0, targetCondoCount);
          } else if (Array.isArray(boxConfig.condoImages) && boxConfig.condoImages.length > 0) {
            condoImagesToUse = boxConfig.condoImages.slice(0, targetCondoCount);
          } else if (propertyContext?.images && propertyContext.images.length > 0) {
            condoImagesToUse = propertyContext.images.slice(0, targetCondoCount).map((img, i) => ({
              index: i + 1,
              filename: img.filename || `Condo Photo #${i + 1}`,
              url: img.url,
              data_url: img.url,
            }));
          }
        }
      }
      // 3. Interior / Enhanced Photos (3rd Attached)
      let enhancedImagesToUse: any[] = [];
      const hasAttachmentSteps = Array.isArray(attachmentSteps) && attachmentSteps.length > 0;
      // If modern attachment steps are configured, DO NOT attach legacy enhanced photos on top!
      const shouldAttachEnhanced = !hasAttachmentSteps && boxConfig.useEnhancedImages === true && useEnhancedImages;
      const targetEnhancedCount = typeof enhancedImagesCount === 'number' ? enhancedImagesCount : 5;
      if (shouldAttachEnhanced && targetEnhancedCount > 0) {
        const isEnhancedSrc = enhancedImagesSource === 'enhanced';
        const sourcePool = isEnhancedSrc && availableEnhancedPhotos.length > 0
          ? availableEnhancedPhotos
          : availableSourcePhotos;
        enhancedImagesToUse = sourcePool.slice(0, targetEnhancedCount).map((img, i) => ({
          index: img.index || i + 1,
          filename: img.filename || `Interior Photo #${img.index || i + 1}`,
          url: img.url,
          data_url: img.url,
        }));
      }

      const promptToUse = (resolvedPromptPreview || currentPromptText || 'Create facebook advertisement from the attached reference and building photos').trim();
      const effectiveHeroGroupName = (boxConfig.title && boxConfig.title !== 'Tab Group' ? boxConfig.title : (boxConfig.browserGroupName || currentGroup?.name || targetGroupName || 'FB Hero'));
      const isDirectStaging = boxConfig.stagingMode === 'direct_tab2' || boxConfig.skipTab1 === true || (boxConfig.stagingMode !== 'two_stage' && boxConfig.stagingMode !== 'two_stage_tabs' && boxConfig.workerTabCount === 1);

      // 0. Instantly focus Chrome profile and ChatGPT tab
      focusBrowserTabGroup({
        profileId: activeProf?.id || selectedProfileId,
        profileKey: profKey,
        groupName: effectiveHeroGroupName,
        groupTabUrls: ['https://chatgpt.com/'],
        url: 'https://chatgpt.com/',
        tabMode: boxConfig.workerTabMode || 'existing_tabs',
        workerCount: isDirectStaging ? 1 : 2,
        reuseSessionTabs: boxConfig.reuseSessionTabs !== false,
        force: true,
      }).catch(() => { });

      const isTikTok = (boxConfig.title || '').toLowerCase().includes('tiktok') || effectiveHeroGroupName.toLowerCase().includes('tiktok');
      const isBoltHaven = (boxConfig.title || '').toLowerCase().includes('bolthaven') || effectiveHeroGroupName.toLowerCase().includes('bolthaven');
      const isDot = (boxConfig.title || '').toLowerCase().includes('dot') || effectiveHeroGroupName.toLowerCase().includes('dot');
      const calculatedPrefix = isTikTok ? (isBoltHaven ? 'bolthaven_tiktok_hero' : (isDot ? 'dot_tiktok_hero' : 'tiktok_hero')) : 'fb_hero';

      const resp = await fetch('http://127.0.0.1:9224/start-two-stage-staging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_key: profKey,
          listing_code: effectiveListingCode,
          group_name: effectiveHeroGroupName,
          node_id: boxConfig.id,
          prefix: calculatedPrefix,
          condo_name: matchedCondoInfo?.matched_folder || aiExtractedCondoName || condoSearchQuery || condoName,
          matched_folder: matchedCondoInfo?.matched_folder || '',
          condo_images: condoImagesToUse,
          enhanced_images: enhancedImagesToUse,
          initial_prompt: promptToUse,
          reference_image: refImgToUse,
          reference_image_index: activeReferenceImage?.index || 1,
          enable_prompt_enhance: enablePromptEnhance,
          target_folder: boxConfig.targetFolder || localStorage.getItem('bolthaven_condo_target_folder') || '',
          use_condo_images: condoImagesToUse.length > 0,
          use_reference_image: !!refImgToUse,
          skip_tab1: isDirectStaging,
          tab_mode: boxConfig.workerTabMode || 'existing_tabs',
          worker_count: isDirectStaging ? 1 : 2,
          reuse_session_tabs: boxConfig.reuseSessionTabs !== false,
        }),
      });
      const data = await resp.json();
      if (isSidebarStoppedRef.current) return;
      if (data.status === 'success') {
        const attachTotalCount = (refImgToUse ? 1 : 0) + condoImagesToUse.length + enhancedImagesToUse.length;
        setTwoStageMessage(
          isDirectStaging
            ? `🚀 Direct Mode (1 Tab): Opening connected browser & attaching ${attachTotalCount} images for "${data.matched_folder || condoName}"...`
            : `🚀 2-Stage Mode (2 Tabs): Tab 1 generating prompt for "${data.matched_folder || condoName}"...`
        );

        let pollCount = 0;
        const interval = setInterval(async () => {
          if (isSidebarStoppedRef.current) {
            clearInterval(interval);
            twoStageIntervalRef.current = null;
            return;
          }
          pollCount++;
          if (pollCount > 160) {
            clearInterval(interval);
            twoStageIntervalRef.current = null;
            setIsRunningTwoStage(false);
            setTwoStageMessage('Hero generation completed or timed out.');
            return;
          }
          try {
            const pollParams = new URLSearchParams();
            if (boxConfig.id) pollParams.set('node_id', boxConfig.id);
            if (targetGroupName) pollParams.set('group', targetGroupName);
            if (condoName) pollParams.set('condo', condoName);
            if (effectiveListingCode) pollParams.set('listing_code', effectiveListingCode);
            const stResp = await fetch(`http://127.0.0.1:9224/two-stage-status?${pollParams.toString()}`);
            const stData = await stResp.json();
            if (isSidebarStoppedRef.current) {
              clearInterval(interval);
              twoStageIntervalRef.current = null;
              return;
            }
            if (stData && stData.state) {
              setTwoStageStatus(stData.state);
              if (stData.state.downloaded_image_url || stData.state.downloaded_file) {
                const file = stData.state.downloaded_file;
                const cand = {
                  fileName: file,
                  condoName: stData.state.condo_name,
                  nodeId: stData.state.node_id,
                  groupName: stData.state.group_name,
                };
                if (isImageRelevantToThisNode(cand, boxConfig, targetGroupName)) {
                  const imgUrl = stData.state.downloaded_image_url || `http://127.0.0.1:9224/hero-downloaded-image?file=${encodeURIComponent(file)}`;
                  updateLatestHeroImage({
                    url: imgUrl,
                    fileName: file,
                    filePath: stData.state.downloaded_file_path || '',
                    condoName: stData.state.condo_name || condoName,
                    createdAt: stData.state.updated_at,
                    nodeId: boxConfig.id,
                    groupName: targetGroupName,
                  });
                }
              }
              if (stData.state.step === 'stopped') {
                clearInterval(interval);
                twoStageIntervalRef.current = null;
                setIsRunningTwoStage(false);
                setTwoStageMessage('Automation stopped.');
              } else if (stData.state.step === 'stage1_running') {
                setTwoStageMessage('⏳ Tab 1: Pasted prompt, generating & extracting output...');
              } else if (stData.state.step === 'stage1_completed') {
                setTwoStageMessage(
                  isDirectStaging
                    ? `⚡ Direct Mode (1 Tab): Prompt ready, attaching ${attachTotalCount} images...`
                    : '✓ Tab 1: Extracted prompt! Focusing Tab 2...'
                );
              } else if (stData.state.step === 'stage2_running') {
                setTwoStageMessage(stData.state.message || `🖼️ Attaching ${attachTotalCount} images and pasting prompt...`);
              } else if (stData.state.step === 'generating_image') {
                setTwoStageMessage(stData.state.message || '🎨 Generating Hero Image in ChatGPT...');
              } else if (stData.state.step === 'downloading_image') {
                setTwoStageMessage(stData.state.message || '⬇️ Downloading generated Hero Image...');
              } else if (stData.state.step === 'completed') {
                clearInterval(interval);
                twoStageIntervalRef.current = null;
                setIsRunningTwoStage(false);
                setTwoStageMessage(
                  `🎉 Complete! Hero Image generated & downloaded (${stData.state.downloaded_file || `${stData.state.images_attached || 4} images attached`}).`
                );
                if (stData.state.downloaded_image_url || stData.state.downloaded_file) {
                  const file = stData.state.downloaded_file;
                  const cand = {
                    fileName: file,
                    condoName: stData.state.condo_name,
                    nodeId: stData.state.node_id,
                    groupName: stData.state.group_name,
                  };
                  if (isImageRelevantToThisNode(cand, boxConfig, targetGroupName)) {
                    const imgUrl = stData.state.downloaded_image_url || `http://127.0.0.1:9224/hero-downloaded-image?file=${encodeURIComponent(file)}`;
                    updateLatestHeroImage({
                      url: imgUrl,
                      fileName: file,
                      condoName: stData.state.condo_name || condoName,
                      createdAt: stData.state.updated_at,
                      nodeId: boxConfig.id,
                      groupName: targetGroupName,
                    });
                  }
                }
              } else if (stData.state.step === 'error') {
                clearInterval(interval);
                twoStageIntervalRef.current = null;
                setIsRunningTwoStage(false);
                setTwoStageMessage(`⚠️ Error: ${stData.state.error}`);
              }
            }
          } catch (e) { }
        }, 2000);
        twoStageIntervalRef.current = interval;
      } else {
        setIsRunningTwoStage(false);
        setTwoStageMessage(`Error starting: ${data.message || 'Unknown error'}`);
      }
    } catch (e: any) {
      setIsRunningTwoStage(false);
      setTwoStageMessage(`Connection error: ${e.message}`);
    }
  };

  // Sync state back to canvas box config (using latestBoxConfigRef so async effects never overwrite referenceImage or enabled with a stale closure)
  const updateMultiConfig = (updates: Record<string, any>) => {
    const current = latestBoxConfigRef.current || boxConfig;
    const preservedRefImg =
      'referenceImage' in updates
        ? updates.referenceImage
        : (current.referenceImage || referenceImage || getPersistedReferenceImage(current.id) || undefined);
    const nextConfig = {
      ...current,
      ...(preservedRefImg !== undefined ? { referenceImage: preservedRefImg } : {}),
      ...updates,
    };
    if (!('enabled' in updates) && typeof boxConfig.enabled === 'boolean') {
      nextConfig.enabled = boxConfig.enabled;
    }
    latestBoxConfigRef.current = nextConfig;
    const payload = { ...nextConfig };
    if (!('enabled' in updates)) {
      delete (payload as any).enabled;
    }
    onUpdateBoxConfig(payload);
  };

  const updateConfig = (key: string, value: any) => {
    updateMultiConfig({ [key]: value });
  };

  // Load profiles and watcher status
  useEffect(() => {
    fetchBrowserProfiles().then((data) => {
      if (data && data.length > 0) {
        setProfiles(data);
        const matched =
          data.find((p) =>
            (boxConfig.browserProfileKey && p.profile_key === boxConfig.browserProfileKey) ||
            (boxConfig.browserProfileName && (p.display_name === boxConfig.browserProfileName || boxConfig.browserProfileName.includes(p.display_name))) ||
            (selectedProfileId && p.id === selectedProfileId)
          ) ||
          data[0];
        if (matched) {
          setSelectedProfileId(matched.id);
        }
      }
    });

    fetchProcessingLanes().then((laneData) => {
      if (laneData && laneData.length > 0) {
        setLanes(laneData);
      }
    });

    fetchDownloadWatcherStatus().then((s) => {
      if (s) setDownloadWatcher(s);
    });
  }, []);

  // Sync selectedProfileId when boxConfig profile changes (prefer stable profile_key/name over DB row id)
  useEffect(() => {
    if (boxConfig.browserProfileKey && profiles.length > 0) {
      const match = profiles.find((p) => p.profile_key === boxConfig.browserProfileKey);
      if (match) {
        setSelectedProfileId(match.id);
        return;
      }
    }
    if (boxConfig.browserProfileName && profiles.length > 0) {
      const match = profiles.find(
        (p) => p.display_name === boxConfig.browserProfileName || p.display_name.includes(boxConfig.browserProfileName)
      );
      if (match) {
        setSelectedProfileId(match.id);
        return;
      }
    }
    if (boxConfig.browserProfileId) {
      setSelectedProfileId(boxConfig.browserProfileId);
    }
  }, [boxConfig.browserProfileId, boxConfig.browserProfileKey, boxConfig.browserProfileName, profiles]);

  // When profile changes, automatically reload and bind tab groups & tabs
  useEffect(() => {
    if (selectedProfileId) {
      const currentProf = profiles.find((p) => p.id === selectedProfileId);
      // Guard: if boxConfig specifies a browserProfileKey and profiles have loaded, don't overwrite with a stale DB row id
      if (
        boxConfig.browserProfileKey &&
        profiles.length > 0 &&
        currentProf &&
        currentProf.profile_key !== boxConfig.browserProfileKey
      ) {
        return;
      }
      const profKey = currentProf?.profile_key || boxConfig.browserProfileKey || (profiles[0]?.profile_key || 'Pro');
      const profName = currentProf?.display_name || boxConfig.browserProfileName || (profiles[0]?.display_name || 'Note Zin Wai');

      fetchTabGroups(selectedProfileId, profKey, profName).then((groups) => {
        setTabGroups(groups);
        if (groups && groups.length > 0) {
          const myTarget = (
            boxConfig.title && boxConfig.title !== 'Tab Group' && !boxConfig.title.startsWith('External Browser')
              ? boxConfig.title
              : (boxConfig.browserGroupName || targetGroupName)
          ).toLowerCase();

          const targetGroup =
            groups.find((g) => g.name.toLowerCase() === myTarget) ||
            groups.find((g) => myTarget && (myTarget.includes(g.name.toLowerCase()) || g.name.toLowerCase().includes(myTarget))) ||
            (boxConfig.browserGroupId ? groups.find((g) => g.id === boxConfig.browserGroupId) : undefined);

          if (targetGroup) {
            setSelectedGroupName(targetGroup.name);

            const tabs = targetGroup.tabs || [];
            const firstTab = tabs[0];
            const firstId = firstTab ? firstTab.id : '';
            const firstTitle = firstTab ? firstTab.title : '';

            setSelectedTabId(firstId);

            updateMultiConfig({
              browserProfileId: selectedProfileId,
              browserProfileKey: currentProf?.profile_key || profKey,
              browserProfileName: currentProf?.display_name || profName,
              browserGroupName: targetGroup.name,
              browserTabId: firstId,
              browserTabTitle: firstTitle,
              browserGroupTabUrls: tabs.map((t) => t.url).filter(Boolean),
              _liveGroupTabs: tabs.map((t) => ({ id: t.id, title: t.title, url: t.url })),
              subtitle: `${tabs.length} Tabs`,
            });
          } else if (isTabGroupNode) {
            setSelectedGroupName(boxConfig.title || targetGroupName);
          }
        } else if (!isTabGroupNode) {
          setSelectedGroupName('');
          setSelectedTabId('');
          updateMultiConfig({
            browserGroupName: '',
            browserTabId: '',
            browserTabTitle: '',
            _liveGroupTabs: [],
          });
        }
      });
    }
  }, [selectedProfileId, profiles, isTabGroupNode, targetGroupName]);

  const lastEnhancedSigRef = useRef<string>('');
  const lastQueueSigRef = useRef<string>('');
  const lastStatusSigRef = useRef<string>('');

  // Load live image queue for current property only (never show historical runs)
  const loadQueue = () => {
    const currentPropId = propertyContext?.id;
    if (currentPropId) {
      if (queueJobs.length === 0) setIsLoadingQueue(true);
      fetchImageQueue(currentPropId).then((jobs) => {
        const matching = (jobs || []).filter((j) => j.property_id === currentPropId);
        const qSig = matching.map((j) => `${j.id}:${j.status}:${j.enhanced_url || ''}`).join('|');
        if (qSig !== lastQueueSigRef.current) {
          lastQueueSigRef.current = qSig;
          setQueueJobs(matching);
        }
        setIsLoadingQueue(false);
      });
    } else {
      if (lastQueueSigRef.current !== '') {
        lastQueueSigRef.current = '';
        setQueueJobs([]);
      }
      setIsLoadingQueue(false);
    }
  };

  useEffect(() => {
    if (isHeroNode) return;
    loadQueue();
    if (!isAutomating) return;
    const interval = setInterval(loadQueue, 4000);
    return () => clearInterval(interval);
  }, [propertyContext?.id, isHeroNode, isAutomating]);

  // Poll automation progress and downloaded enhanced images
  useEffect(() => {
    if (isHeroNode) return;
    let interval: any = null;
    const checkProgressAndImages = async () => {
      try {
        const status = await getAutomationStatus();
        if (status) {
          const stSig = `${status.is_running}:${status.completed}:${status.failed}:${status.total}`;
          if (stSig !== lastStatusSigRef.current) {
            lastStatusSigRef.current = stSig;
            setAutomationStatus(status);
            if (status.is_running) {
              setIsAutomating(true);
            } else {
              setIsAutomating(false);
              if (status.completed !== undefined && status.completed > 0) {
                setAutomationMessage(`✓ All tabs finished! ${status.completed} images enhanced.`);
              }
            }
          }
        }
      } catch (e) { }

      try {
        const effectiveListingCode = propertyContext?.listingCode || (() => {
          try {
            return localStorage.getItem('bolthaven_active_session_listing_code') || '';
          } catch {
            return '';
          }
        })();
        if (!propertyContext?.id && !effectiveListingCode) {
          if (lastEnhancedSigRef.current !== '') {
            lastEnhancedSigRef.current = '';
            setEnhancedImages((prev) => (prev.length > 0 ? [] : prev));
          }
          return;
        }
        const enhanced = await fetchEnhancedDownloadedImages(propertyContext?.id, effectiveListingCode);
        if (enhanced && enhanced.length > 0) {
          const maxAllowed = receivedImages.length > 0 ? receivedImages.length : 99;
          const valid = enhanced.filter((img) => (img.position || 1) <= maxAllowed);
          if (valid.length > 0) {
            const { sorted: sortedValid, hasCustomOrder } = sortEnhancedByCustomOrder(
              valid,
              (boxConfig as any).enhancedImagesOrder
            );
            const sig = sortedValid.map((img) => `${img.position}:${img.backend_url || img.url}:${(img as any).size_bytes || (img as any).size || ''}`).join('|');
            if (sig !== lastEnhancedSigRef.current) {
              lastEnhancedSigRef.current = sig;
              setEnhancedImages(sortedValid);
              if (onEnhancedPhotosUpdate) {
                onEnhancedPhotosUpdate(buildEnhancedPhotoMap(sortedValid, hasCustomOrder));
              }
            }
          } else if (lastEnhancedSigRef.current !== '') {
            lastEnhancedSigRef.current = '';
            setEnhancedImages([]);
          }
        } else if (lastEnhancedSigRef.current !== '') {
          lastEnhancedSigRef.current = '';
          setEnhancedImages((prev) => (prev.length > 0 ? [] : prev));
        }
      } catch (e) { }

      if (isAutomating) {
        loadQueue();
      }
    };

    checkProgressAndImages();
    interval = isAutomating ? setInterval(checkProgressAndImages, 1500) : null;

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isAutomating, propertyContext?.id, propertyContext?.listingCode, receivedImages.length]);

  // Notify parent of running state changes (only emit false when this node itself transitions from running -> stopped)
  const wasReportingRunningRef = useRef(false);
  useEffect(() => {
    const isNowRunning = boxConfig.enabled !== false && (isAutomating || isRunningTwoStage);
    if (isNowRunning) {
      wasReportingRunningRef.current = true;
      onRunningChange?.(true);
    } else if (wasReportingRunningRef.current) {
      wasReportingRunningRef.current = false;
      onRunningChange?.(false);
    }
  }, [boxConfig.enabled, isAutomating, isRunningTwoStage, onRunningChange]);

  // Handler: Start Multi-Tab Automated Queue across all tabs in selected group (supports optional targetPositions for missing photos)
  const handleStartGroupAutomation = async (targetPositions?: number[]) => {
    if (boxConfig.enabled === false) {
      setAutomationMessage('⚠️ This step is disabled. Enable Node Status above to run it.');
      return;
    }
    if (autoRunTimerRef.current) {
      clearTimeout(autoRunTimerRef.current);
      autoRunTimerRef.current = null;
    }
    isSidebarStoppedRef.current = false;
    hasAutoStartedRef.current = true;
    setAutoRunCountdown(null);
    const profId = activeProfile?.id || selectedProfileId;
    const profKey = activeProfile?.profile_key || boxConfig.browserProfileKey || (profiles[0]?.profile_key || 'Pro');
    const propId = propertyContext?.id || `PROP-${Date.now()}`;
    const effectiveGroupName = currentGroup?.name || targetGroupName || selectedGroupName || (isHeroNode ? 'FB Hero' : 'Enhance IMG');

    // Filter images if targetPositions (missing photos) is specified
    const targetSet = targetPositions && targetPositions.length > 0 ? new Set(targetPositions) : null;
    const imagesToProcess = targetSet
      ? activeImages.filter((img, i) => {
        const pos = typeof img.index === 'number' && img.index > 0 ? img.index : i + 1;
        return targetSet.has(pos);
      })
      : activeImages;

    const effectiveWorkerCount = isHeroNode
      ? (boxConfig.skipTab1 || boxConfig.stagingMode === 'direct_tab2' || boxConfig.workerTabCount === 1 ? 1 : 2)
      : Math.min(Math.max(1, imagesToProcess.length), boxConfig.workerTabCount || (groupTabs.length || 4));
    const isNewTabsMode = (boxConfig as any).workerTabMode === 'new_tabs';
    let targetUrls = isNewTabsMode
      ? Array(effectiveWorkerCount).fill('https://chatgpt.com/')
      : groupTabs.map((t) => t.url).filter((u) => u && !u.includes('6ad49918') && !u.includes('6ad49924'));
    if (targetUrls.length === 0 || isNewTabsMode) {
      targetUrls = Array(effectiveWorkerCount).fill('https://chatgpt.com/');
    } else if (targetUrls.length > effectiveWorkerCount) {
      targetUrls = targetUrls.slice(0, effectiveWorkerCount);
    }

    const hasImages = imagesToProcess.length > 0 || queueJobs.length > 0;
    if (!hasImages && enablePromptEnhance) {
      setAutomationMessage('⚠️ No images selected for this run. Please select photos or check image source.');
      return;
    }

    setIsAutomating(true);

    // 0. INSTANT BROWSER FOCUS: Bring Chrome and the ChatGPT tab group to front immediately on click
    focusBrowserTabGroup({
      profileId: profId,
      profileKey: profKey,
      groupName: effectiveGroupName,
      groupTabUrls: targetUrls,
      url: targetUrls[0],
      tabMode: isNewTabsMode ? 'new_tabs' : ((boxConfig as any).workerTabMode || 'existing_tabs'),
      workerCount: effectiveWorkerCount,
      reuseSessionTabs: (boxConfig as any).reuseSessionTabs !== false,
      force: true,
    }).catch(() => { });

    // Always use the prompt selected in the template preview / dropdown
    const promptToUse = enablePromptEnhance
      ? (resolvedPromptPreview || currentPromptText || resolvePromptForBrowserNode(
        {
          ...boxConfig,
          browserPromptTemplateKey: selectedPromptKey,
          browserPromptText: resolvedPromptPreview || currentPromptText,
          resolvedPrompt: resolvedPromptPreview || currentPromptText,
        },
        {
          title: propertyContext?.title,
          price: propertyContext?.price,
          width: outputWidth,
          height: outputHeight,
        }
      ))
      : '';

    const imgs = imagesToProcess.map((img, i) => {
      const originalPos = typeof img.index === 'number' && img.index > 0 ? img.index : (targetPositions && targetPositions[i] ? targetPositions[i] : i + 1);
      return {
        index: originalPos,
        source_url: img.url,
        stored_url: img.url,
        width: outputWidth,
        height: outputHeight,
        resolved_prompt: promptToUse,
      };
    });

    // Create or refresh batch queue with the active images if prompt enhancement is active
    let createdBatchJobs: ImageProcessingJob[] = [];
    if (imagesToProcess.length > 0 && enablePromptEnhance) {
      try {
        createdBatchJobs = await createBatchImageQueue({
          property_id: propId,
          property_name: propertyContext?.title || 'Featured Property Listing',
          prompt_template_text: promptToUse,
          images: imgs,
          processing_mode: processingMode,
          lane_id: selectedLaneKey,
          prompt_template_id: selectedPromptKey,
          output_width: outputWidth,
          output_height: outputHeight,
          strict_preservation_active: strictPreservation,
          property_metadata: {
            listing_code: propertyContext?.listingCode || '',
          },
        });
        if (isSidebarStoppedRef.current) return;
        await startImageQueue(propId);
        if (isSidebarStoppedRef.current) return;
        await loadQueue();
      } catch (err) {
        console.warn('Queue init error:', err);
      }
    }

    if (isSidebarStoppedRef.current) return;

    // Verify browser tabs are active (quick verification with 3s timeout)
    try {
      setAutomationMessage(`Chrome [${profKey}] active. Verifying ChatGPT tabs...`);
      await waitForBrowserTabsReady({
        profileKey: profKey,
        groupName: effectiveGroupName,
        expectedUrls: targetUrls,
        maxWaitMs: 3000,
        shouldCancel: () => isSidebarStoppedRef.current,
        onProgress: (msg) => {
          if (!isSidebarStoppedRef.current) setAutomationMessage(msg);
        },
      });
    } catch (e) {
      console.warn('Tab verification notice:', e);
    }

    if (isSidebarStoppedRef.current) return;

    // Collect numeric tab IDs from groupTabs
    const tabIds: number[] = groupTabs
      .map((t) => {
        if (typeof t.id === 'number') return t.id;
        const parsed = parseInt(String(t.id).replace(/\D/g, ''), 10);
        return isNaN(parsed) ? 0 : parsed;
      })
      .filter((id) => id > 0);

    const finalTabIds = tabIds.length > 0 ? tabIds : Array.from({ length: effectiveWorkerCount }, (_, i) => i + 1);

    setIsAutomating(true);
    setAutomationMessage(
      targetPositions
        ? `⚡ Re-queued and working ${imagesToProcess.length} missing photos: [${targetPositions.map((p) => '#' + p).join(', ')}] across ${finalTabIds.length} tabs...`
        : `Auto-opened Chrome [${profKey}] & Tab Group [${effectiveGroupName}]. Processing across ${effectiveWorkerCount} tabs...`
    );

    const res = await startAutomation({
      property_id: propId,
      listing_code: effectiveListingCode,
      profile_key: profKey,
      group_name: effectiveGroupName,
      group_tab_urls: targetUrls,
      tab_ids: finalTabIds,
      tab_mode: isNewTabsMode ? 'new_tabs' : ((boxConfig as any).workerTabMode || 'existing_tabs'),
      worker_count: effectiveWorkerCount,
      reuse_session_tabs: (boxConfig as any).reuseSessionTabs ?? true,
      jobs: (createdBatchJobs.length > 0 ? createdBatchJobs : queueJobs).map((j) => ({
        ...j,
        listing_code: effectiveListingCode || (j as any).listing_code || '',
      })),
    });
    if (isSidebarStoppedRef.current) return;

    if (!res.success) {
      setIsAutomating(false);
      setAutomationMessage(`Error: ${res.message}`);
      setTimeout(() => setAutomationMessage(null), 4500);
    } else {
      setAutomationMessage(
        targetPositions
          ? `⚡ Re-queued & working ${imagesToProcess.length} missing photos across ${finalTabIds.length} tabs...`
          : `⚡ Processing images across ${finalTabIds.length} tabs...`
      );
      loadQueue();
    }
  };

  // Handler: Stop Multi-Tab Automation
  const handleStopGroupAutomation = async () => {
    isSidebarStoppedRef.current = true;
    if (autoRunTimerRef.current) {
      clearTimeout(autoRunTimerRef.current);
      autoRunTimerRef.current = null;
    }
    if (twoStageIntervalRef.current) {
      clearInterval(twoStageIntervalRef.current);
      twoStageIntervalRef.current = null;
    }
    hasAutoStartedRef.current = true;
    setAutoRunCountdown(null);
    setIsAutomating(false);
    setIsRunningTwoStage(false);
    onRunningChange?.(false);
    setTwoStageMessage('Automation stopped.');
    try {
      window.dispatchEvent(new CustomEvent('ea_workflow_stop_all'));
    } catch {}
    await stopAutomation();
    setAutomationMessage('Automation stopped.');
    loadQueue();
    setTimeout(() => setAutomationMessage(null), 3000);
  };

  useEffect(() => {
    const onStopAll = () => {
      isSidebarStoppedRef.current = true;
      if (autoRunTimerRef.current) {
        clearTimeout(autoRunTimerRef.current);
        autoRunTimerRef.current = null;
      }
      if (twoStageIntervalRef.current) {
        clearInterval(twoStageIntervalRef.current);
        twoStageIntervalRef.current = null;
      }
      hasAutoStartedRef.current = true;
      setAutoRunCountdown(null);
      setIsAutomating(false);
      setIsRunningTwoStage(false);
      setAutomationMessage('Automation stopped.');
      setTwoStageMessage('Automation stopped.');
    };
    window.addEventListener('ea_workflow_stop_all', onStopAll);
    return () => {
      window.removeEventListener('ea_workflow_stop_all', onStopAll);
      if (twoStageIntervalRef.current) {
        clearInterval(twoStageIntervalRef.current);
        twoStageIntervalRef.current = null;
      }
    };
  }, []);


  // Standard Image Prompt Templates + Custom Library Prompts
  const promptOptions = useMemo(() => {
    // Append prompts from user's saved prompt library
    const libraryPrompts = (availablePrompts && availablePrompts.length > 0 ? availablePrompts : loadAvailablePromptTemplates()).map((ap) => ({
      id: String(ap.id),
      name: ap.name,
      category: ap.category || 'LIBRARY',
      instructions: ap.templateText,
    }));

    const allPrompts = [
      ...STANDARD_BROWSER_PROMPTS,
      ...libraryPrompts,
      {
        id: 'custom_prompt',
        name: 'Custom Enhancement Prompt',
        category: 'CUSTOM',
        instructions: customPromptText || 'Enhance photo maintaining authentic structure.',
      },
    ];

    if (isHeroNode) {
      // Generate Image node: only return Generate Image prompts
      return allPrompts.filter((p) => isGenerateCategory(p.category, p.name) || p.id === 'custom_prompt');
    } else {
      // Enhance Image node: only return Enhance Image prompts
      return allPrompts.filter((p) => isEnhanceCategory(p.category, p.name) || p.id === 'custom_prompt');
    }
  }, [customPromptText, availablePrompts, isHeroNode]);

  // Active Images based on Image Source selection
  const activeImages = useMemo(() => {
    if (imageSourceMode === 'hero_only') {
      return receivedImages.slice(0, 1);
    }
    if (imageSourceMode === 'selected') {
      return receivedImages.filter((img, i) =>
        selectedImageIndices.includes(typeof img.index === 'number' && img.index > 0 ? img.index : i + 1)
      );
    }
    if (imageSourceMode === 'custom_upload' && referenceImage) {
      return [{ url: referenceImage, index: 1, filename: 'Custom Uploaded Image' }];
    }
    return receivedImages;
  }, [receivedImages, imageSourceMode, selectedImageIndices, referenceImage]);

  // Selected Reference Image for Generation
  const activeReferenceImage = useMemo(() => {
    if (referenceImage) {
      return { url: referenceImage, label: 'Custom Upload File', index: 0 };
    }
    if (referenceImageMode === 'picked') {
      const found = receivedImages.find((img, i) => (img.index || i + 1) === selectedReferenceIndex);
      if (found) {
        return {
          url: found.url,
          label: `Photo #${found.index || selectedReferenceIndex}`,
          index: found.index || selectedReferenceIndex,
        };
      }
    }
    if (referenceImageMode === 'condo_scan' && matchedCondoInfo?.images?.[0]) {
      return { url: matchedCondoInfo.images[0].data_url, label: matchedCondoInfo.images[0].filename, index: 0 };
    }
    const first = receivedImages[0];
    return first ? { url: first.url, label: `Photo #${first.index || 1}`, index: first.index || 1 } : null;
  }, [referenceImageMode, referenceImage, receivedImages, selectedReferenceIndex, matchedCondoInfo]);

  // Effective Upstream AI Prompts
  const effectiveUpstreamPrompts = useMemo(() => {
    const list = propertyContext?.upstreamPrompts || [];
    if (list.length > 0) return list;
    return [
      {
        id: 'fb_hero_prompt_ai',
        title: 'FB Hero Prompt',
        text: 'Generate a hero real estate listing image based on condo unit context and reference styling. Maintain realistic architectural aesthetics, high dynamic range, and authentic materials.',
      },
    ];
  }, [propertyContext?.upstreamPrompts]);

  // Missing positions for Enhance automation: all expected photos that are not yet downloaded as enhanced images
  const missingPositions = useMemo(() => {
    const allPositions = activeImages.length > 0
      ? activeImages.map((img, i) => (typeof img.index === 'number' && img.index > 0 ? img.index : i + 1))
      : queueJobs.length > 0
        ? queueJobs.map((j) => j.original_position || 1)
        : [];
    const downloadedPositions = new Set(enhancedImages.map((img) => img.position));
    return allPositions.filter((pos) => !downloadedPositions.has(pos)).sort((a, b) => a - b);
  }, [queueJobs, activeImages, enhancedImages]);

  // Upstream AI Node Prompt Object
  const selectedUpstreamPromptObj = useMemo(() => {
    return effectiveUpstreamPrompts.find((p) => p.id === selectedUpstreamAiId) || effectiveUpstreamPrompts[0];
  }, [effectiveUpstreamPrompts, selectedUpstreamAiId]);

  // Effective prompt key guaranteed to exist within current category options
  const effectivePromptKey = useMemo(() => {
    if (promptOptions.some((p) => p.id === selectedPromptKey)) {
      return selectedPromptKey;
    }
    return promptOptions[0]?.id || (isHeroNode ? 'fb_hero_master' : 'photo_retouch');
  }, [promptOptions, selectedPromptKey, isHeroNode]);

  // Current selected prompt instruction text
  const currentPromptText = useMemo(() => {
    if (promptSourceMode === 'upstream_ai') {
      return selectedUpstreamPromptObj?.text || selectedUpstreamPromptObj?.title || 'Formulate Facebook property advertisement prompt...';
    }
    if (promptSourceMode === 'custom' || effectivePromptKey === 'custom_prompt') {
      return customPromptText;
    }
    const targetKey = String(effectivePromptKey || '').trim().toLowerCase();
    const found = promptOptions.find(
      (p) => String(p.id).trim().toLowerCase() === targetKey || p.name.trim().toLowerCase() === targetKey
    );
    return found ? found.instructions : (promptOptions[0]?.instructions || '');
  }, [promptSourceMode, selectedUpstreamPromptObj, effectivePromptKey, customPromptText, promptOptions]);

  // Human-readable source label
  const promptSourceLabel = useMemo(() => {
    if (!enablePromptEnhance) return 'Disabled (No Prompt)';
    if (promptSourceMode === 'upstream_ai') {
      return selectedUpstreamPromptObj?.title || 'Upstream AI';
    }
    if (promptSourceMode === 'custom') {
      return 'Custom Prompt';
    }
    const found = promptOptions.find((p) => p.id === selectedPromptKey);
    return found ? found.name : 'Preset Template';
  }, [enablePromptEnhance, promptSourceMode, selectedUpstreamPromptObj, promptOptions, selectedPromptKey]);

  // Resolve live prompt preview
  useEffect(() => {
    fetchPromptPreview({
      template_text: currentPromptText,
      property_name: propertyContext?.title || 'Luxury Bangkok Residence',
      property_metadata: {
        price: propertyContext?.price || '฿45,000 / month',
        unit_details: '2 Bedroom · 65 Sqm · High Floor',
      },
      image_position: 1,
      total_images: receivedImages.length || 6,
      output_width: outputWidth,
      output_height: outputHeight,
    }).then((resolved) => {
      if (resolved) setResolvedPromptPreview(resolved);
    });
  }, [currentPromptText, propertyContext, receivedImages.length, outputWidth, outputHeight]);

  // Active selected Chrome profile
  const activeProfile = useMemo(() => {
    if (boxConfig.browserProfileKey) {
      const match = profiles.find((p) => p.profile_key === boxConfig.browserProfileKey);
      if (match) return match;
    }
    if (boxConfig.browserProfileId) {
      const match = profiles.find((p) => p.id === boxConfig.browserProfileId);
      if (match) return match;
    }
    if (boxConfig.browserProfileName) {
      const match = profiles.find(
        (p) => p.display_name === boxConfig.browserProfileName || p.display_name.includes(boxConfig.browserProfileName)
      );
      if (match) return match;
    }
    return profiles.find((p) => p.id === selectedProfileId) || profiles[0];
  }, [profiles, selectedProfileId, boxConfig.browserProfileKey, boxConfig.browserProfileId, boxConfig.browserProfileName]);

  // Target group for this node (Strict Group Isolation across all flows)
  const currentGroup: BrowserGroupItem = useMemo(() => {
    const target = targetGroupName.toLowerCase();

    // 1. Strict exact match by name
    let matched = tabGroups.find((g) => g.name.toLowerCase() === target);

    // 2. Exact match by saved browserGroupId
    if (!matched && boxConfig.browserGroupId) {
      matched = tabGroups.find((g) => g.id === boxConfig.browserGroupId);
    }

    // 3. Exact match by boxConfig.browserGroupName or boxConfig.title
    if (!matched && boxConfig.browserGroupName) {
      const bgn = boxConfig.browserGroupName.toLowerCase();
      matched = tabGroups.find((g) => g.name.toLowerCase() === bgn);
    }
    if (!matched && boxConfig.title && boxConfig.title !== 'Tab Group') {
      const bt = boxConfig.title.toLowerCase();
      matched = tabGroups.find((g) => g.name.toLowerCase() === bt);
    }

    // 4. Fuzzy match on target name (only if target is specific, not generic 'tab group')
    if (!matched && target && target !== 'tab group' && !target.startsWith('external browser')) {
      matched = tabGroups.find((g) => {
        const gn = g.name.toLowerCase();
        const isTargetTikTok = target.includes('tiktok');
        const isGroupTikTok = gn.includes('tiktok');
        if (isTargetTikTok !== isGroupTikTok) return false;

        const isTargetFB = (target.includes('fb') || target.includes('facebook')) && !isTargetTikTok;
        const isGroupFB = (gn.includes('fb') || gn.includes('facebook')) && !isGroupTikTok;
        if (isTargetFB !== isGroupFB) return false;

        if (target.includes('bolthaven') && (gn.includes('dot') || gn.includes('dot_'))) return false;
        if (target.includes('dot') && (gn.includes('bolthaven') || gn.includes('bh_'))) return false;

        return gn === target || target.includes(gn) || gn.includes(target);
      });
    }

    // 5. Role-based fallback ONLY if the node specifically targets Enhance, TikTok, or FB Hero
    if (!matched) {
      if (isEnhanceNode) {
        matched = tabGroups.find((g) => {
          const gn = g.name.toLowerCase();
          return gn.includes('enhance') && !gn.includes('hero') && !gn.includes('fb') && !gn.includes('tiktok');
        });
      } else if (target.includes('tiktok')) {
        matched = tabGroups.find((g) => {
          const gn = g.name.toLowerCase();
          if (!gn.includes('tiktok')) return false;
          if (target.includes('bolthaven') && (gn.includes('dot') || gn.includes('dot_'))) return false;
          if (target.includes('dot') && (gn.includes('bolthaven') || gn.includes('bh_'))) return false;
          return true;
        });
      } else if (target.includes('hero') || target.includes('fb')) {
        matched = tabGroups.find((g) => {
          const gn = g.name.toLowerCase();
          return (gn.includes('hero') || gn.includes('fb')) && !gn.includes('enhance') && !gn.includes('tiktok');
        });
      }
    }

    if (matched) return matched;

    // Node's own saved or default tabs (never grab FB Hero or Enhance IMG when inspecting another flow node like Flow-5146!)
    const savedLive: BrowserTabItem[] = (boxConfig._liveGroupTabs || []).filter((t: any) => Boolean(t && (t.title || t.url)));
    const savedUrls: string[] = (boxConfig.browserGroupTabUrls || []).filter(Boolean);
    const count = savedLive.length || savedUrls.length || (isHeroNode ? 1 : 4);

    const groupDisplayName = boxConfig.title || boxConfig.browserGroupName || targetGroupName;
    const defaultTabs: BrowserTabItem[] = [
      {
        id: `tab-${target.replace(/[^a-z0-9]/g, '-')}-1`,
        title: `${groupDisplayName} Worker #1`,
        url: savedUrls[0] || 'https://chatgpt.com',
        hostname: 'chatgpt.com',
        is_chatgpt: true,
        is_connected: true,
        is_selected: true,
      },
    ];

    return {
      id: `default-${target.replace(/[^a-z0-9]/g, '-')}`,
      name: groupDisplayName,
      color: isHeroNode ? '#8B5CF6' : '#3B82F6',
      is_active: true,
      tabs_count: count,
      tabs: savedLive.length > 0
        ? savedLive
        : (savedUrls.length > 0
          ? savedUrls.map((u: string, i: number): BrowserTabItem => ({
            id: `tab-${i + 1}`,
            title: `${groupDisplayName} Worker #${i + 1}`,
            url: u,
            hostname: 'chatgpt.com',
            is_chatgpt: true,
            is_connected: true,
            is_selected: i === 0,
          }))
          : defaultTabs),
    };
  }, [tabGroups, targetGroupName, boxConfig.browserGroupId, boxConfig._liveGroupTabs, boxConfig.browserGroupTabUrls, boxConfig.title, boxConfig.browserGroupName, isHeroNode, isEnhanceNode]);

  const displayGroups = useMemo(() => {
    return [currentGroup];
  }, [currentGroup]);

  // Active selected Tab Group
  const activeGroup = useMemo(() => {
    return currentGroup;
  }, [currentGroup]);

  // Active tabs inside Group 1 (Photo Enhancement)
  const groupTabs = useMemo(() => {
    return activeGroup?.tabs || [];
  }, [activeGroup]);

  // Active selected Tab Group 2 (FB Hero / Staging)
  const stagingGroup = useMemo(() => {
    return (
      tabGroups.find((g) => g.name === stagingGroupName) ||
      tabGroups.find((g) => g.name.toLowerCase().includes('fb')) ||
      tabGroups.find((g) => g.tabs_count === 2 && g.name !== activeGroup?.name)
    );
  }, [tabGroups, stagingGroupName, activeGroup]);

  // Active tabs inside Group 2 (Staging & Ad Creation)
  const stagingGroupTabs = useMemo(() => {
    return stagingGroup?.tabs || [];
  }, [stagingGroup]);

  // Reset auto-started guard whenever property ID changes
  useEffect(() => {
    hasAutoStartedRef.current = false;
  }, [propertyContext?.id]);

  // Copy prompt to clipboard
  const handleCopyPrompt = () => {
    const textToCopy = resolvedPromptPreview || currentPromptText;
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  // Launch / Focus Chrome Profile & Tab Group on Mac
  const handleOpenProfile = async () => {
    const profId = activeProfile?.id || selectedProfileId;
    const profKey = activeProfile?.profile_key || boxConfig.browserProfileKey || (profiles[0]?.profile_key || 'Pro');
    const effectiveGroupName = currentGroup?.name || targetGroupName || selectedGroupName || (isHeroNode ? 'FB Hero' : 'Enhance IMG');
    if (profId) {
      setIsOpeningProfile(true);
      try {
        const effectiveWorkerCount = isHeroNode
          ? (boxConfig.skipTab1 || boxConfig.stagingMode === 'direct_tab2' || boxConfig.workerTabCount === 1 ? 1 : 2)
          : (boxConfig.workerTabCount || (groupTabs.length || 4));
        const isNewTabs = (boxConfig as any).workerTabMode === 'new_tabs';
        let targetUrls = isNewTabs
          ? Array(effectiveWorkerCount).fill('https://chatgpt.com/')
          : groupTabs.map((t) => t.url).filter((u) => u && !u.includes('6ad49918') && !u.includes('6ad49924'));
        if (targetUrls.length === 0 || isNewTabs) {
          targetUrls = Array(effectiveWorkerCount).fill('https://chatgpt.com/');
        } else if (targetUrls.length > effectiveWorkerCount) {
          targetUrls = targetUrls.slice(0, effectiveWorkerCount);
        }
        const res = await focusBrowserTabGroup({
          profileId: profId,
          profileKey: profKey,
          groupName: effectiveGroupName,
          groupTabUrls: targetUrls,
          url: targetUrls[0],
          tabMode: isNewTabs ? 'new_tabs' : (boxConfig.workerTabMode || 'existing_tabs'),
          workerCount: effectiveWorkerCount,
          reuseSessionTabs: boxConfig.reuseSessionTabs !== false,
          force: true,
        });
        if (res.success) {
          setSyncMessage(`Chrome "${activeProfile?.display_name || profKey}" & "${effectiveGroupName}" (${effectiveWorkerCount} ${effectiveWorkerCount === 1 ? 'tab' : 'tabs'}) opened!`);
        } else {
          setSyncMessage(res.message || 'Could not open Chrome profile.');
        }
      } catch (err: any) {
        setSyncMessage(err?.message || 'Error opening Chrome profile.');
      } finally {
        setTimeout(() => setIsOpeningProfile(false), 800);
        setTimeout(() => setSyncMessage(null), 3500);
      }
    }
  };

  // Launch URL inside selected Chrome Profile on Mac
  const handleOpenTab = async () => {
    const profId = activeProfile?.id || selectedProfileId;
    const profKey = activeProfile?.profile_key;
    const active = groupTabs.find((t) => t.id === selectedTabId) || groupTabs[0];
    const targetUrl = active?.url || 'https://chatgpt.com/';
    if (profId) {
      try {
        const res = await openBrowserTab(profId, targetUrl, profKey);
        if (res.success) {
          setSyncMessage(`Tab "${active?.title || 'Selected'}" focused in Chrome!`);
        } else {
          setSyncMessage(res.message || 'Could not open tab.');
        }
      } catch (err: any) {
        setSyncMessage(err?.message || 'Error opening tab.');
      } finally {
        setTimeout(() => setSyncMessage(null), 3500);
      }
    }
  };

  // Sync discovered Chrome profiles from host Mac
  const handleSyncProfiles = async () => {
    setIsSyncingProfiles(true);
    setSyncMessage(null);
    try {
      const result = await syncBrowserProfiles();
      if (result.profiles && result.profiles.length > 0) {
        setProfiles(result.profiles);
        if (result.addedCount > 0) {
          setSyncMessage(`Synced! Added ${result.addedCount} new Chrome profile${result.addedCount > 1 ? 's' : ''} from your Mac.`);
        } else {
          setSyncMessage('All local Chrome profiles are already connected.');
        }
      }
    } catch {
      setSyncMessage('Failed to scan local Chrome profiles.');
    } finally {
      setIsSyncingProfiles(false);
      setTimeout(() => setSyncMessage(null), 4000);
    }
  };

  // Register a custom profile manually
  const handleRegisterProfile = async () => {
    if (!newProfileDisplayName.trim() || !newProfileKey.trim()) {
      setSaveProfileError('Display Name and Profile Directory are required.');
      return;
    }
    setIsSavingProfile(true);
    setSaveProfileError(null);
    try {
      const created = await registerBrowserProfile(
        newProfileKey.trim(),
        newProfileDisplayName.trim(),
        newProfileEmail.trim()
      );
      if (created) {
        const freshProfiles = await fetchBrowserProfiles();
        setProfiles(freshProfiles);
        setSelectedProfileId(created.id);
        updateMultiConfig({
          browserProfileId: created.id,
          browserProfileName: created.display_name,
        });
        setIsAddProfileOpen(false);
        setNewProfileDisplayName('');
        setNewProfileKey('');
        setNewProfileEmail('');
        setSyncMessage(`Profile "${created.display_name}" added and selected!`);
        setTimeout(() => setSyncMessage(null), 3000);
      } else {
        setSaveProfileError('Failed to register profile. Please check your inputs.');
      }
    } catch (e: any) {
      setSaveProfileError(e?.message || 'Failed to register profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // ── Modular Process Cards (Shared across all node modes) ─────────────────
  const renderReferenceImageCard = () => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        paddingBottom: '0.75rem',
        borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid #F1F5F9',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <FiImage size={15} style={{ color: isDark ? '#8B949E' : '#64748B', flexShrink: 0 }} />
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: isDark ? '#F0F6FC' : '#0F172A' }}>
          Reference Layout
        </span>
      </div>

      {referenceImage ? (
        <div style={{ paddingLeft: '23px', display: 'flex', alignItems: 'center' }}>
          <img
            src={referenceImage}
            alt="Reference Layout"
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '6px',
              objectFit: 'cover',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #E2E8F0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
              flexShrink: 0,
            }}
          />
        </div>
      ) : null}
      {/* Full-view Image Modal (Lightbox) */}
      {previewModalImage && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            padding: '20px',
            boxSizing: 'border-box',
          }}
          onClick={() => setPreviewModalImage(null)}
        >
          <div
            style={{
              maxWidth: '92vw',
              maxHeight: '92vh',
              backgroundColor: isDark ? '#25282B' : '#FFFFFF',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid #CBD5E1',
              borderRadius: '12px',
              boxShadow: '0 24px 48px rgba(0, 0, 0, 0.5), 0 8px 16px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxSizing: 'border-box',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 16px',
                borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #E2E8F0',
                backgroundColor: isDark ? '#181A1D' : '#F8FAFC',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    color: '#10B981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <FiCheckCircle size={14} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '0.8125rem',
                      fontWeight: 700,
                      color: isDark ? '#F3F4F6' : '#1E293B',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {previewModalImage.title || 'Full Resolution Image Preview'}
                  </div>
                  {previewModalImage.fileName && (
                    <div
                      style={{
                        fontSize: '0.625rem',
                        color: isDark ? '#8B949E' : '#64748B',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {previewModalImage.fileName}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                {previewModalImage.fileName && (
                  <button
                    type="button"
                    onClick={() => {
                      fetch(`http://127.0.0.1:9224/reveal-file?file=${encodeURIComponent(previewModalImage.fileName || '')}`).catch(() => { });
                    }}
                    style={{
                      height: '28px',
                      padding: '0 10px',
                      borderRadius: '6px',
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
                      border: '1px solid var(--border-color)',
                      color: isDark ? '#F3F4F6' : '#1E293B',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                    title="Reveal in Finder"
                  >
                    <FiFolder size={12} />
                    <span>Reveal in Finder</span>
                  </button>
                )}

                <a
                  href={previewModalImage.url}
                  download={previewModalImage.fileName || 'download.png'}
                  style={{
                    height: '28px',
                    padding: '0 10px',
                    borderRadius: '6px',
                    backgroundColor: '#2563EB',
                    border: '1px solid #1D4ED8',
                    color: '#FFFFFF',
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    textDecoration: 'none',
                    boxShadow: '0 1px 3px rgba(37, 99, 235, 0.3)',
                  }}
                  title="Download image file"
                >
                  <FiDownload size={12} />
                  <span>Download</span>
                </a>

                <button
                  type="button"
                  onClick={() => setPreviewModalImage(null)}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
                    border: 'none',
                    color: isDark ? '#9CA3AF' : '#6B7280',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#EF4444')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = isDark ? '#9CA3AF' : '#6B7280')}
                  title="Close modal (Esc)"
                >
                  <FiX size={16} />
                </button>
              </div>
            </div>

            {/* Modal Image Body */}
            <div
              style={{
                padding: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#0a0a0a',
                overflow: 'auto',
                maxHeight: 'calc(92vh - 120px)',
              }}
            >
              <img
                src={previewModalImage.url}
                alt={previewModalImage.title || 'Image Preview'}
                style={{
                  maxWidth: '100%',
                  maxHeight: 'calc(80vh - 60px)',
                  width: 'auto',
                  height: 'auto',
                  objectFit: 'contain',
                  borderRadius: '6px',
                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.7)',
                  display: 'block',
                }}
              />
            </div>

            {/* Modal Footer (File path) */}
            {previewModalImage.filePath && (
              <div
                style={{
                  padding: '8px 14px',
                  borderTop: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #E2E8F0',
                  backgroundColor: isDark ? '#181A1D' : '#F8FAFC',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  fontSize: '0.625rem',
                }}
              >
                <div
                  style={{
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    color: isDark ? '#93C5FD' : '#1D4ED8',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}
                  title={previewModalImage.filePath}
                >
                  {previewModalImage.filePath}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(previewModalImage.filePath || '');
                    setCopiedHeroPath(true);
                    setTimeout(() => setCopiedHeroPath(false), 2000);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: copiedHeroPath ? '#10B981' : (isDark ? '#9CA3AF' : '#6B7280'),
                    fontSize: '0.625rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    flexShrink: 0,
                  }}
                >
                  {copiedHeroPath ? <FiCheck size={11} /> : <FiCopy size={11} />}
                  <span>{copiedHeroPath ? 'Copied' : 'Copy Path'}</span>
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
  const renderImagesToEnhanceCard = () => (
    <div
      style={{
        borderRadius: '12px',
        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#FFFFFF',
        border: '1px solid var(--border-color)',
        padding: '0.875rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.65rem',
        boxShadow: isDark ? '0 1px 3px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <div
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '6px',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              color: '#10B981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <FiImage size={13} />
          </div>
          <div
            style={{
              fontSize: '0.78125rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
            }}
          >
            Image(s) to Enhance
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {receivedImages.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const allNums = receivedImages.map((p, i) => (typeof p.index === 'number' && p.index > 0 ? p.index : i + 1));
                const allSelected = imageSourceMode !== 'selected' || selectedImageIndices.length === allNums.length;
                const nextIndices = allSelected ? [] : allNums;
                setSelectedImageIndices(nextIndices);
                setImageSourceMode('selected');
                updateMultiConfig({
                  selectedImageIndices: nextIndices,
                  imageSourceMode: 'selected',
                });
              }}
              style={{
                fontSize: '0.625rem',
                fontWeight: 600,
                padding: '0 10px',
                height: '24px',
                lineHeight: '24px',
                borderRadius: '6px',
                border: isDark ? '1px solid rgba(255,255,255,0.15)' : '1px solid #CBD5E1',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F1F5F9',
                color: isDark ? '#94A3B8' : '#64748B',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                minWidth: 'max-content',
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0';
                e.currentTarget.style.color = isDark ? '#F1F5F9' : '#1E293B';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.05)' : '#F1F5F9';
                e.currentTarget.style.color = isDark ? '#94A3B8' : '#64748B';
              }}
            >
              <span style={{ whiteSpace: 'nowrap', display: 'inline-block' }}>
                {(imageSourceMode !== 'selected' || selectedImageIndices.length === receivedImages.length) ? 'Deselect All' : 'Select All'}
              </span>
            </button>
          )}
          <span
            style={{
              fontSize: '0.625rem',
              fontWeight: 700,
              padding: '2px 8px',
              height: '24px',
              borderRadius: '12px',
              backgroundColor: activeImages.length > 0 ? 'rgba(16, 185, 129, 0.12)' : isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
              color: activeImages.length > 0 ? '#10B981' : 'var(--text-secondary)',
              border: activeImages.length > 0 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-color)',
              letterSpacing: '0.02em',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {activeImages.length} of {receivedImages.length} Active
          </span>
        </div>
      </div>

      {receivedImages.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gridAutoRows: '64px',
            gap: '6px',
            maxHeight: '180px',
            overflowY: 'auto',
            padding: '6px',
            backgroundColor: isDark ? 'rgba(0, 0, 0, 0.25)' : '#FFFFFF',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
          }}
        >
          {receivedImages.map((img, idx) => {
            const photoNum = typeof img.index === 'number' && img.index > 0 ? img.index : idx + 1;
            const allNums = receivedImages.map((p, i) => (typeof p.index === 'number' && p.index > 0 ? p.index : i + 1));
            const isChecked = imageSourceMode === 'selected'
              ? selectedImageIndices.includes(photoNum)
              : true;
            return (
              <div
                key={idx}
                onClick={() => {
                  const currentSelected = imageSourceMode === 'selected'
                    ? selectedImageIndices
                    : allNums;
                  let nextIndices: number[];
                  if (isChecked) {
                    nextIndices = currentSelected.filter((n) => n !== photoNum);
                  } else {
                    nextIndices = [...currentSelected, photoNum].sort((a, b) => a - b);
                  }
                  setSelectedImageIndices(nextIndices);
                  setImageSourceMode('selected');
                  updateMultiConfig({
                    selectedImageIndices: nextIndices,
                    imageSourceMode: 'selected',
                  });
                }}
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '64px',
                  minHeight: '64px',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  border: isChecked
                    ? (isDark ? '2px solid rgba(5, 150, 105, 0.95)' : '2px solid #059669')
                    : (isDark ? '1px solid #334155' : '1px solid #CBD5E1'),
                  boxShadow: isChecked
                    ? (isDark ? '0 0 0 1px rgba(5, 150, 105, 0.3), 0 2px 8px rgba(5, 150, 105, 0.25)' : '0 0 0 1px rgba(5, 150, 105, 0.2), 0 2px 8px rgba(5, 150, 105, 0.2)')
                    : 'none',
                  background: isDark ? '#1E293B' : '#E2E8F0',
                  cursor: 'pointer',
                  opacity: isChecked ? 1 : 0.45,
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                  userSelect: 'none',
                }}
              >
                <img
                  src={img.url}
                  alt={img.filename || `Photo #${photoNum}`}
                  referrerPolicy="no-referrer"
                  crossOrigin={img.url?.startsWith('data:') || img.url?.startsWith('blob:') ? undefined : 'anonymous'}
                  onError={(e) => {
                    const fallbackUrl = img.url;
                    if (
                      fallbackUrl &&
                      !fallbackUrl.startsWith('data:') &&
                      !fallbackUrl.startsWith('blob:') &&
                      !e.currentTarget.src.includes('/proxy-image')
                    ) {
                      e.currentTarget.src = `http://127.0.0.1:9224/proxy-image?url=${encodeURIComponent(fallbackUrl)}`;
                    }
                  }}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                    pointerEvents: 'none',
                  }}
                  loading="lazy"
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    backgroundColor: isChecked ? '#059669' : 'rgba(0, 0, 0, 0.45)',
                    border: isChecked ? 'none' : '1px solid rgba(255, 255, 255, 0.4)',
                    color: '#FFFFFF',
                    fontSize: '10px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backdropFilter: 'blur(3px)',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
                    transition: 'all 0.15s ease',
                    pointerEvents: 'none',
                  }}
                >
                  {isChecked ? '✓' : ''}
                </div>
                <span
                  style={{
                    position: 'absolute',
                    bottom: '4px',
                    right: '4px',
                    backgroundColor: isChecked ? 'rgba(5, 150, 105, 0.95)' : 'rgba(0, 0, 0, 0.75)',
                    color: '#fff',
                    fontSize: '0.55rem',
                    fontWeight: 700,
                    padding: '1px 5px',
                    borderRadius: '4px',
                    backdropFilter: 'blur(2px)',
                    boxShadow: isChecked ? '0 1px 3px rgba(0, 0, 0, 0.3)' : 'none',
                    pointerEvents: 'none',
                  }}
                >
                  #{photoNum}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          style={{
            padding: '8px 10px',
            borderRadius: '6px',
            backgroundColor: isDark ? 'rgba(0, 0, 0, 0.15)' : '#FFFFFF',
            border: '1px dashed var(--border-color)',
            fontSize: '0.625rem',
            color: 'var(--text-muted)',
            textAlign: 'center',
          }}
        >
          No images received from &ldquo;Get Images&rdquo; yet. Connect Get Images to load photos.
        </div>
      )}
      {/* Full-view Image Modal (Lightbox) */}
      {previewModalImage && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            padding: '20px',
            boxSizing: 'border-box',
          }}
          onClick={() => setPreviewModalImage(null)}
        >
          <div
            style={{
              maxWidth: '92vw',
              maxHeight: '92vh',
              backgroundColor: isDark ? '#25282B' : '#FFFFFF',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid #CBD5E1',
              borderRadius: '12px',
              boxShadow: '0 24px 48px rgba(0, 0, 0, 0.5), 0 8px 16px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxSizing: 'border-box',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 16px',
                borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #E2E8F0',
                backgroundColor: isDark ? '#181A1D' : '#F8FAFC',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    color: '#10B981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <FiCheckCircle size={14} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '0.8125rem',
                      fontWeight: 700,
                      color: isDark ? '#F3F4F6' : '#1E293B',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {previewModalImage.title || 'Full Resolution Image Preview'}
                  </div>
                  {previewModalImage.fileName && (
                    <div
                      style={{
                        fontSize: '0.625rem',
                        color: isDark ? '#8B949E' : '#64748B',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {previewModalImage.fileName}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                {previewModalImage.fileName && (
                  <button
                    type="button"
                    onClick={() => {
                      fetch(`http://127.0.0.1:9224/reveal-file?file=${encodeURIComponent(previewModalImage.fileName || '')}`).catch(() => { });
                    }}
                    style={{
                      height: '28px',
                      padding: '0 10px',
                      borderRadius: '6px',
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
                      border: '1px solid var(--border-color)',
                      color: isDark ? '#F3F4F6' : '#1E293B',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                    title="Reveal in Finder"
                  >
                    <FiFolder size={12} />
                    <span>Reveal in Finder</span>
                  </button>
                )}

                <a
                  href={previewModalImage.url}
                  download={previewModalImage.fileName || 'download.png'}
                  style={{
                    height: '28px',
                    padding: '0 10px',
                    borderRadius: '6px',
                    backgroundColor: '#2563EB',
                    border: '1px solid #1D4ED8',
                    color: '#FFFFFF',
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    textDecoration: 'none',
                    boxShadow: '0 1px 3px rgba(37, 99, 235, 0.3)',
                  }}
                  title="Download image file"
                >
                  <FiDownload size={12} />
                  <span>Download</span>
                </a>

                <button
                  type="button"
                  onClick={() => setPreviewModalImage(null)}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
                    border: 'none',
                    color: isDark ? '#9CA3AF' : '#6B7280',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#EF4444')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = isDark ? '#9CA3AF' : '#6B7280')}
                  title="Close modal (Esc)"
                >
                  <FiX size={16} />
                </button>
              </div>
            </div>

            {/* Modal Image Body */}
            <div
              style={{
                padding: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#0a0a0a',
                overflow: 'auto',
                maxHeight: 'calc(92vh - 120px)',
              }}
            >
              <img
                src={previewModalImage.url}
                alt={previewModalImage.title || 'Image Preview'}
                style={{
                  maxWidth: '100%',
                  maxHeight: 'calc(80vh - 60px)',
                  width: 'auto',
                  height: 'auto',
                  objectFit: 'contain',
                  borderRadius: '6px',
                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.7)',
                  display: 'block',
                }}
              />
            </div>

            {/* Modal Footer (File path) */}
            {previewModalImage.filePath && (
              <div
                style={{
                  padding: '8px 14px',
                  borderTop: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #E2E8F0',
                  backgroundColor: isDark ? '#181A1D' : '#F8FAFC',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  fontSize: '0.625rem',
                }}
              >
                <div
                  style={{
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    color: isDark ? '#93C5FD' : '#1D4ED8',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}
                  title={previewModalImage.filePath}
                >
                  {previewModalImage.filePath}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(previewModalImage.filePath || '');
                    setCopiedHeroPath(true);
                    setTimeout(() => setCopiedHeroPath(false), 2000);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: copiedHeroPath ? '#10B981' : (isDark ? '#9CA3AF' : '#6B7280'),
                    fontSize: '0.625rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    flexShrink: 0,
                  }}
                >
                  {copiedHeroPath ? <FiCheck size={11} /> : <FiCopy size={11} />}
                  <span>{copiedHeroPath ? 'Copied' : 'Copy Path'}</span>
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '2rem' }}>
      {/* Node Header Banner */}
      {!isHeroNode && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.875rem 1rem',
            borderRadius: '12px',
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#FFFFFF',
            border: '1px solid var(--border-color)',
            boxShadow: isDark ? '0 1px 3px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: isTabGroupNode
                ? 'linear-gradient(135deg, #06B6D4, #0891B2)'
                : isProfileNode
                  ? 'linear-gradient(135deg, #3B82F6, #1D4ED8)'
                  : 'linear-gradient(135deg, #6366F1, #4F46E5)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {isTabGroupNode ? <FiLayers size={16} /> : isProfileNode ? <FaChrome size={17} /> : <FiMonitor size={16} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {isTabGroupNode
                ? `Tab Group — ${currentGroup.name || boxConfig.browserGroupName || boxConfig.title || (isHeroNode ? 'FB Hero' : 'Enhance IMG')}`
                : isProfileNode
                  ? `Chrome Profile — ${activeProfile?.display_name || boxConfig.browserProfileName || 'Hsu'}`
                  : 'External Browser Node'}
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', rowGap: '4px', marginTop: '3px' }}>
              {isTabGroupNode ? (
                <>
                  <span style={{ whiteSpace: 'nowrap' }}>
                    Connected: <strong style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{boxConfig.browserProfileName || connectedProfileName || activeProfile?.display_name || 'Note Zin Wai'}</strong> ({boxConfig.browserProfileKey || activeProfile?.profile_key || 'Pro'})
                  </span>
                  {connectedProfileNodeId && onOpenProfileNode && (
                    <button
                      type="button"
                      onClick={() => onOpenProfileNode(connectedProfileNodeId)}
                      title="View Chrome Profile configuration"
                      style={{
                        background: isDark ? 'rgba(59, 130, 246, 0.12)' : 'rgba(59, 130, 246, 0.08)',
                        border: isDark ? '1px solid rgba(59, 130, 246, 0.25)' : '1px solid rgba(59, 130, 246, 0.2)',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        color: isDark ? '#93C5FD' : '#2563EB',
                        fontSize: '0.625rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        whiteSpace: 'nowrap',
                        lineHeight: 1.4,
                      }}
                    >
                      <FiArrowLeft size={9} /> View
                    </button>
                  )}
                  {boxConfig.reuseSessionTabs !== false && (
                    <span
                      title="Memorized worker tabs bound to this group"
                      style={{
                        fontSize: '0.625rem',
                        fontWeight: 600,
                        color: '#10B981',
                        backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#DCFCE7',
                        border: isDark ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(16, 185, 129, 0.3)',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        whiteSpace: 'nowrap',
                        lineHeight: 1.4,
                      }}
                    >
                      💾 Memorized
                    </span>
                  )}
                </>
              ) : isProfileNode ? (
                `${activeProfile?.profile_key || boxConfig.browserProfileKey || (profiles[0]?.profile_key || 'Pro')} · Connected Tab Groups`
              ) : (
                'Chrome Automation · Processing Pipeline'
              )}
            </div>
          </div>
        </div>
      )}

      {!isProfileNode && !isTabGroupNode ? (
        <>
          {/* SECTION A — PROCESSING ENGINE (Parent Box) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Processing Mode
            </label>
            <Select
              options={[
                { value: 'chrome_assisted', label: '1. Chrome / ChatGPT Assisted (Default)' },
                { value: 'two_stage_staging', label: '2. Two-Stage Tab Group (Prompt Gen Tab 1 → Auto Condo Staging Tab 2)' },
                { value: 'local_enhance', label: '3. Local Image Enhancement (Unattended Native)' },
                { value: 'authorized_api', label: '4. Authorized Image API (Official API Limits)' },
              ]}
              value={processingMode}
              onChange={(val) => {
                setProcessingMode(val as BrowserProcessingMode);
                updateConfig('browserProcessingMode', val);
              }}
            />

            {/* Mode Explanatory Callout */}
            <div
              style={{
                padding: '0.5rem 0.65rem',
                borderRadius: '6px',
                background: isDark ? '#1E293B' : '#F8FAFC',
                border: '1px solid var(--border-color)',
                fontSize: '0.6875rem',
                color: isDark ? '#94A3B8' : '#64748B',
                lineHeight: 1.4,
              }}
            >
              {processingMode === 'chrome_assisted' && (
                <div>
                  <strong style={{ color: 'var(--text-primary)' }}>Chrome / ChatGPT Assisted:</strong> Prepares exact room-preserving prompts and files, focuses your selected Chrome profile & ChatGPT tab group, guides manual submission/download, and automatically collects completed files.
                </div>
              )}
              {processingMode === 'two_stage_staging' && (
                <div>
                  <strong style={{ color: 'var(--text-primary)' }}>Two-Stage Staging:</strong> Multi-group workflow under the same profile. Tab 1 generates the prompt copy, then Tab 2 receives the reference image (pasted 1st), local condo images (1, 2, 3), and the extracted prompt!
                </div>
              )}
              {processingMode === 'local_enhance' && (
                <div>
                  <strong style={{ color: 'var(--text-primary)' }}>Local Image Enhancement:</strong> Runs completely unattended on your Mac. Applies deterministic dynamic range restoration, shadow lifting, white balance calibration, and 1080x1350 4:5 scaling without external API fees.
                </div>
              )}
              {processingMode === 'authorized_api' && (
                <div>
                  <strong style={{ color: 'var(--text-primary)' }}>Authorized Image API:</strong> Processes via official OpenAI/Runware endpoints with strict server-side authentication, concurrency limits, and configured spending caps.
                </div>
              )}
            </div>
          </div>

          {/* ASSIGNED CHROME PROFILE (SIMPLE SUMMARY FOR PARENT BOX) */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.6rem',
              padding: '0.75rem 0.875rem',
              borderRadius: '8px',
              backgroundColor: isDark ? 'var(--bg-surface)' : '#F8FAFC',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Assigned Chrome Profile
              </label>
              <span style={{ fontSize: '0.625rem', color: '#10B981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981' }} />
                Connected
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.6rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#FFFFFF',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <FiMonitor size={16} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {activeProfile?.display_name || boxConfig.browserProfileName || 'Hsu'}
                    </span>
                    <span
                      style={{
                        fontSize: '0.5625rem',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        backgroundColor: isDark ? '#374151' : '#E2E8F0',
                        color: isDark ? '#9CA3AF' : '#64748B',
                        fontWeight: 600,
                      }}
                    >
                      {activeProfile?.profile_key || boxConfig.browserProfileKey || (profiles[0]?.profile_key || 'Pro')}
                    </span>
                  </div>
                  {activeProfile?.email && (
                    <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                      {activeProfile.email}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {connectedProfileNodeId && onOpenProfileNode && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onOpenProfileNode(connectedProfileNodeId)}
                style={{
                  width: '100%',
                  fontSize: '0.6875rem',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#FFFFFF',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <span>Open &ldquo;{activeProfile?.display_name || 'Hsu'}&rdquo; Profile Node for Tabs & Pipelines</span>
                <FiExternalLink size={11} />
              </Button>
            )}
          </div>

        </>
      ) : isProfileNode ? (
        <>
          {/* PROFILE BROWSER BOX SIDEBAR: Render profile manager, tab groups, worker tabs, relative prompts & pipelines */}
          {/* SECTION B — CHROME PROFILE MANAGER */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              padding: '0.75rem 0.875rem',
              borderRadius: '8px',
              backgroundColor: isDark ? 'var(--bg-surface)' : '#F8FAFC',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Chrome Profile
                </label>
                <span
                  style={{
                    fontSize: '0.625rem',
                    color: '#10B981',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981' }} />
                  Connected
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsAddProfileOpen(!isAddProfileOpen)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '2px 4px',
                  borderRadius: '4px',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  color: isAddProfileOpen ? '#EF4444' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  transition: 'opacity 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.75')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                {isAddProfileOpen ? <FiX size={12} /> : <FiPlus size={12} />}
                <span>{isAddProfileOpen ? 'Close' : '+ Add'}</span>
              </button>
            </div>

            {/* Chrome Profile Card Box Selection */}
            {isProfileNode ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.65rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#FFFFFF',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '6px',
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
                      color: 'var(--text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <FiMonitor size={15} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {activeProfile?.display_name || boxConfig.browserProfileName || 'Hsu'}
                      </span>
                      <span
                        style={{
                          fontSize: '0.5625rem',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          backgroundColor: isDark ? '#374151' : '#E2E8F0',
                          color: isDark ? '#9CA3AF' : '#64748B',
                          fontWeight: 600,
                          flexShrink: 0,
                        }}
                      >
                        {activeProfile?.profile_key || boxConfig.browserProfileKey || (profiles[0]?.profile_key || 'Pro')}
                      </span>
                    </div>
                    {activeProfile?.email && (
                      <div
                        style={{
                          fontSize: '0.625rem',
                          color: 'var(--text-muted)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          marginTop: '1px',
                        }}
                      >
                        {activeProfile.email}
                      </div>
                    )}
                  </div>
                </div>
                <span style={{ color: '#10B981', display: 'flex', alignItems: 'center' }}>
                  <FiCheckCircle size={16} />
                </span>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.45rem',
                  maxHeight: '240px',
                  overflowY: 'auto',
                  paddingRight: '2px',
                }}
              >
                {profiles.map((p) => {
                  const isSelected = selectedProfileId === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        setSelectedProfileId(p.id);
                        updateMultiConfig({
                          browserProfileId: p.id,
                          browserProfileName: p.display_name,
                          browserProfileKey: p.profile_key,
                        });
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.55rem 0.65rem',
                        borderRadius: '6px',
                        border: isSelected
                          ? (isDark ? '1px solid #4B5563' : '1px solid #94A3B8')
                          : '1px solid var(--border-color)',
                        backgroundColor: isSelected
                          ? (isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9')
                          : (isDark ? 'rgba(255, 255, 255, 0.02)' : '#FFFFFF'),
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = isDark ? '#4B5563' : '#CBD5E1';
                          e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.04)' : '#F1F5F9';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = 'var(--border-color)';
                          e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.02)' : '#FFFFFF';
                        }
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            width: '30px',
                            height: '30px',
                            borderRadius: '6px',
                            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
                            color: isSelected ? 'var(--text-primary)' : 'var(--text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <FiMonitor size={15} />
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span
                              style={{
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {p.display_name}
                            </span>
                            <span
                              style={{
                                fontSize: '0.5625rem',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                backgroundColor: isDark ? '#374151' : '#E2E8F0',
                                color: isDark ? '#9CA3AF' : '#64748B',
                                fontWeight: 600,
                                flexShrink: 0,
                              }}
                            >
                              {p.profile_key}
                            </span>
                          </div>
                          {p.email ? (
                            <div
                              style={{
                                fontSize: '0.625rem',
                                color: 'var(--text-muted)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                marginTop: '1px',
                              }}
                            >
                              {p.email}
                            </div>
                          ) : (
                            <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                              {p.integration_id}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', marginLeft: '6px', flexShrink: 0 }}>
                        {isSelected ? (
                          <span style={{ color: '#10B981', display: 'flex', alignItems: 'center' }}>
                            <FiCheckCircle size={16} />
                          </span>
                        ) : (
                          <span
                            style={{
                              width: '14px',
                              height: '14px',
                              borderRadius: '50%',
                              border: isDark ? '1.5px solid #4B5563' : '1.5px solid #CBD5E1',
                              display: 'block',
                            }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {profiles.length === 0 && (
              <div
                style={{
                  fontSize: '0.6875rem',
                  color: 'var(--text-muted)',
                  textAlign: 'center',
                  padding: '0.75rem',
                  border: '1px dashed var(--border-color)',
                  borderRadius: '6px',
                }}
              >
                No Chrome profiles discovered. Click &ldquo;+ Add&rdquo; above to scan or register.
              </div>
            )}

            {/* Status / Feedback message */}
            {syncMessage && (
              <div
                style={{
                  padding: '0.4rem 0.6rem',
                  borderRadius: '5px',
                  fontSize: '0.6875rem',
                  backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
                  color: isDark ? '#34D399' : '#059669',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <FiCheckCircle size={12} />
                <span>{syncMessage}</span>
              </div>
            )}

            {/* Expandable Add / Discover Profile Card */}
            {isAddProfileOpen && (
              <div
                style={{
                  padding: '0.75rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#FFFFFF',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.625rem',
                  marginTop: '0.25rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Add or Sync Chrome Profile
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddProfileOpen(false)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                  >
                    <FiX size={13} />
                  </button>
                </div>

                {/* Quick 1-Click Auto Sync from Mac Chrome */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                    padding: '0.55rem',
                    borderRadius: '6px',
                    backgroundColor: isDark ? 'rgba(0, 0, 0, 0.2)' : '#F8FAFC',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Option 1: Auto-Detect from Mac Chrome
                  </div>
                  <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                    Automatically scans Google Chrome on your Mac (Default, Profile 1, 2, etc.) and imports all discovered user profiles.
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={isSyncingProfiles}
                    onClick={handleSyncProfiles}
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 500,
                      marginTop: '2px',
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#FFFFFF',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <FiRefreshCw size={11} className={isSyncingProfiles ? 'animate-spin' : ''} style={{ marginRight: '5px' }} />
                    {isSyncingProfiles ? 'Scanning Chrome...' : 'Scan & Import All Mac Chrome Profiles'}
                  </Button>
                </div>

                {/* Manual Registration Form */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Option 2: Add Profile Manually
                  </div>
                  <div>
                    <label style={{ fontSize: '0.625rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
                      Display Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Work, Listing Team, Zin Personal"
                      value={newProfileDisplayName}
                      onChange={(e) => setNewProfileDisplayName(e.target.value)}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '5px 8px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        border: isDark ? '1px solid #374151' : '1px solid #CBD5E1',
                        backgroundColor: isDark ? '#111827' : '#FFFFFF',
                        color: 'var(--text-primary)',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.625rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
                      Profile Directory / Key * (e.g. Default, Profile 16, Profile 3)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Profile 16 or Default"
                      value={newProfileKey}
                      onChange={(e) => setNewProfileKey(e.target.value)}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '5px 8px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        border: isDark ? '1px solid #374151' : '1px solid #CBD5E1',
                        backgroundColor: isDark ? '#111827' : '#FFFFFF',
                        color: 'var(--text-primary)',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.625rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
                      Account Email (optional)
                    </label>
                    <input
                      type="email"
                      placeholder="e.g. team@bolthavenproperty.com"
                      value={newProfileEmail}
                      onChange={(e) => setNewProfileEmail(e.target.value)}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '5px 8px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        border: isDark ? '1px solid #374151' : '1px solid #CBD5E1',
                        backgroundColor: isDark ? '#111827' : '#FFFFFF',
                        color: 'var(--text-primary)',
                        outline: 'none',
                      }}
                    />
                  </div>

                  {saveProfileError && (
                    <div style={{ fontSize: '0.625rem', color: '#EF4444' }}>
                      {saveProfileError}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.35rem', marginTop: '2px' }}>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={handleRegisterProfile}
                      disabled={isSavingProfile || !newProfileDisplayName.trim() || !newProfileKey.trim()}
                      style={{ flex: 1, fontSize: '0.6875rem' }}
                    >
                      <FiCheck size={11} style={{ marginRight: '4px' }} />
                      {isSavingProfile ? 'Saving...' : 'Save & Select Profile'}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setIsAddProfileOpen(false)}
                      style={{ fontSize: '0.6875rem' }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {activeProfile && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.6875rem', color: '#94A3B8' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Integration ID:</span>
                  <code style={{ color: isDark ? '#E2E8F0' : '#1E293B' }}>{activeProfile.integration_id}</code>
                </div>
                {activeProfile.email && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Account:</span>
                    <span style={{ color: isDark ? '#CBD5E1' : '#334155' }}>{activeProfile.email}</span>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => fetchBrowserProfiles().then((p) => setProfiles(p))}
                style={{ flex: 1, fontSize: '0.6875rem' }}
              >
                <FiRefreshCw size={11} style={{ marginRight: '4px' }} /> Refresh
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={handleOpenProfile}
                disabled={isOpeningProfile}
                style={{ flex: 1, fontSize: '0.6875rem' }}
              >
                {isOpeningProfile ? (
                  <>
                    <FiRefreshCw size={11} className="animate-spin" style={{ marginRight: '4px' }} /> Opening...
                  </>
                ) : (
                  <>
                    <FiExternalLink size={11} style={{ marginRight: '4px' }} /> Open Profile in Chrome
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Connected Tab Groups on Canvas */}
          <div
            style={{
              padding: '0.75rem 0.875rem',
              borderRadius: '8px',
              backgroundColor: isDark ? 'var(--bg-surface)' : '#F8FAFC',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FiLayers style={{ color: 'var(--text-muted)' }} /> Connected Tab Groups
                </label>
                <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Modular Tab Group boxes attached below this profile on canvas
                </div>
              </div>
            </div>

            {connectedTabGroupNodes && connectedTabGroupNodes.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {connectedTabGroupNodes.map((tg) => (
                  <div
                    key={tg.id}
                    onClick={() => onOpenTabGroupNode?.(tg.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.6rem 0.75rem',
                      borderRadius: '6px',
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#FFFFFF',
                      border: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = isDark ? '#4B5563' : '#CBD5E1';
                      e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.03)' : '#FFFFFF';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#E2E8F0',
                          color: 'var(--text-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <FiLayers size={14} />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {tg.title || tg.browserGroupName || 'Tab Group'}
                        </div>
                        <div style={{ fontSize: '0.625rem', color: isDark ? '#94A3B8' : '#64748B' }}>
                          {tg.subtitle || 'Connected Box'}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      style={{ fontSize: '0.625rem', padding: '2px 8px', height: 'auto', color: 'var(--text-secondary)' }}
                    >
                      Open Settings →
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  padding: '1rem',
                  borderRadius: '6px',
                  border: '1px dashed var(--border-color)',
                  textAlign: 'center',
                  fontSize: '0.6875rem',
                  color: 'var(--text-muted)',
                }}
              >
                No Tab Group boxes connected to this profile yet.
                <div style={{ marginTop: '4px', fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                  Click &ldquo;+ Connect as Box&rdquo; below or click [+] on the canvas node to attach a group.
                </div>
              </div>
            )}
          </div>

          {/* Discovered Chrome Tab Groups */}
          <div
            style={{
              padding: '0.75rem 0.875rem',
              borderRadius: '8px',
              backgroundColor: isDark ? 'var(--bg-surface)' : '#F8FAFC',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FiMonitor style={{ color: 'var(--text-muted)' }} /> Discovered Chrome Tab Groups
                </label>
                <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Attach any discovered tab group as an independent worker box below this profile
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const profId = activeProfile?.id || selectedProfileId;
                  const profKey = activeProfile?.profile_key || boxConfig.browserProfileKey || (profiles[0]?.profile_key || 'Pro');
                  const profName = activeProfile?.display_name || boxConfig.browserProfileName || (profiles[0]?.display_name || 'Note Zin Wai');
                  if (profId) {
                    fetchTabGroups(profId, profKey, profName).then((g) => setTabGroups(g));
                  }
                }}
                style={{ fontSize: '0.625rem', padding: '2px 6px', height: 'auto' }}
              >
                <FiRefreshCw size={10} style={{ marginRight: '3px' }} /> Refresh
              </Button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {(tabGroups.length > 0 ? tabGroups : [
                {
                  id: 'fallback-enh',
                  name: 'Enhance IMG',
                  tabs_count: 4,
                  tabs: [
                    { id: 't1', title: 'ChatGPT - Photo Enhancer', url: 'https://chatgpt.com' },
                    { id: 't2', title: 'ChatGPT - 1:1 Preserver', url: 'https://chatgpt.com' },
                    { id: 't3', title: 'ChatGPT - Interior Restyle', url: 'https://chatgpt.com' },
                    { id: 't4', title: 'ChatGPT - Resolution Booster', url: 'https://chatgpt.com' },
                  ]
                },
                {
                  id: 'fallback-hero',
                  name: 'FB Hero',
                  tabs_count: 2,
                  tabs: [
                    { id: 'h1', title: 'ChatGPT - Staging Prompt Gen', url: 'https://chatgpt.com' },
                    { id: 'h2', title: 'ChatGPT - 1080x1350 Staging Ad', url: 'https://chatgpt.com' },
                  ]
                }
              ]).map((group) => {
                const isAlreadyConnected = connectedTabGroupNodes?.some(
                  (tg) => (tg.title || tg.browserGroupName) === group.name
                );
                const tabs = group.tabs || [];
                return (
                  <div
                    key={group.id || group.name}
                    style={{
                      padding: '0.65rem 0.75rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#FFFFFF',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.4rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--text-muted)' }} />
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {group.name}
                        </span>
                        <span
                          style={{
                            fontSize: '0.5625rem',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            backgroundColor: isDark ? '#374151' : '#E2E8F0',
                            color: isDark ? '#9CA3AF' : '#64748B',
                            fontWeight: 600,
                          }}
                        >
                          {tabs.length || group.tabs_count || 0} Tabs
                        </span>
                      </div>

                      <Button
                        size="sm"
                        variant={isAlreadyConnected ? 'ghost' : 'primary'}
                        disabled={isAlreadyConnected}
                        onClick={() => onAddTabGroupNode?.(group.name, tabs.length || group.tabs_count || 2)}
                        style={{ fontSize: '0.625rem', padding: '3px 8px', height: 'auto' }}
                      >
                        {isAlreadyConnected ? '✓ Added' : '+ Connect as Box'}
                      </Button>
                    </div>

                    {tabs.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '14px' }}>
                        {tabs.slice(0, 3).map((t, idx) => (
                          <div key={t.id || idx} style={{ fontSize: '0.625rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            • {t.title || t.url || `Worker Tab ${idx + 1}`}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <>

          {/* SECTION: CONDO PROPERTY & GET IMAGES (from workflow) */}
          {!isHeroNode && boxConfig.showCondoProjectCard !== false && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
                padding: '0.875rem 1rem',
                borderRadius: '8px',
                backgroundColor: isDark ? '#25282B' : '#FFFFFF',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid var(--border-color)',
                boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              {/* Condo / Property Name */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '7px',
                        backgroundColor: 'rgba(59, 130, 246, 0.12)',
                        color: '#3B82F6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <FiFolder size={14} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '0.78125rem',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        Condo / Project Name
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '0.625rem',
                          color: 'var(--text-muted)',
                          whiteSpace: 'nowrap',
                          marginTop: '1px',
                        }}
                      >
                        <span>From {aboveBoxTitle}</span>
                        <span style={{ opacity: 0.4 }}>•</span>
                        <span
                          style={{
                            fontSize: '0.5625rem',
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: '4px',
                            backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(37, 99, 235, 0.08)',
                            color: 'var(--accent-primary)',
                            border: '1px solid rgba(59, 130, 246, 0.25)',
                            letterSpacing: '0.02em',
                            lineHeight: '1.2',
                          }}
                        >
                          Active Project
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    padding: '0.55rem 0.75rem',
                    borderRadius: '7px',
                    backgroundColor: isDark ? 'rgba(0, 0, 0, 0.25)' : '#F8FAFC',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                  }}
                >
                  {condoName}
                </div>
              </div>
            </div>
          )}

          {/* ── TAB PROCESS MODULES (CONTROLLED BY SETTINGS) ── */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            {isHeroNode ? (
              /* ═════════════════════════════════════════════════════════════════════ */
              /* 🍏 APPLE CLEAN DESIGN FOR FB HERO                                   */
              /* ═════════════════════════════════════════════════════════════════════ */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* Condo Name */}
                {boxConfig.showCondoProjectCard !== false && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0 0 12px 0',
                      borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #F1F5F9',
                    }}
                  >
                    <span style={{ fontSize: '0.75rem', fontWeight: 500, color: isDark ? '#7D828A' : '#64748B' }}>
                      Condo Name
                    </span>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: isDark ? '#ECEEF0' : '#0F172A' }}>
                      {condoName || condoSearchQuery || boxConfig.browserCondoName || boxConfig.title || 'Aspire Erawan Prime'}
                    </span>
                  </div>
                )}

                {/* ── NEW FLOW MODULES FOR HERO NODE ── */}
                {isHeroNode && (
                  <>
                    {/* Output File Name Preview */}
                    {(() => {
                      const effGrp = (boxConfig.title && boxConfig.title !== 'Tab Group' ? boxConfig.title : (boxConfig.browserGroupName || currentGroup?.name || targetGroupName || 'FB Hero'));
                      const isTk = (boxConfig.title || '').toLowerCase().includes('tiktok') || effGrp.toLowerCase().includes('tiktok');
                      const isBh = (boxConfig.title || '').toLowerCase().includes('bolthaven') || effGrp.toLowerCase().includes('bolthaven');
                      const isDt = (boxConfig.title || '').toLowerCase().includes('dot') || effGrp.toLowerCase().includes('dot');
                      const pfx = isTk ? (isBh ? 'bolthaven_tiktok_hero' : (isDt ? 'dot_tiktok_hero' : 'tiktok_hero')) : 'fb_hero';
                      const rawCondo = (matchedCondoInfo?.matched_folder || aiExtractedCondoName || condoSearchQuery || condoName || boxConfig.browserCondoName || 'Property').trim();
                      const cleanCondo = rawCondo.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 20) || 'Property';
                      const codePfx = effectiveListingCode ? `${effectiveListingCode}_` : '';
                      const previewFileName = latestHeroImage?.fileName || `${codePfx}${pfx}_${cleanCondo}_${heroPreviewId}.png`;
                      const isDownloaded = Boolean(latestHeroImage?.fileName);

                      return (
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            padding: '0 0 12px 0',
                            borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #F1F5F9',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                            <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: isDark ? '#8B949E' : '#64748B' }}>
                              {isDownloaded ? 'Downloaded File Name' : 'Output Name Preview'}
                            </span>
                            <span
                              style={{
                                fontSize: '0.625rem',
                                fontWeight: 600,
                                padding: '1px 6px',
                                borderRadius: '4px',
                                backgroundColor: isDownloaded ? 'rgba(63, 185, 80, 0.14)' : (isDark ? '#25282B' : '#E2E8F0'),
                                color: isDownloaded ? '#3FB950' : (isDark ? '#8B949E' : '#475569'),
                              }}
                            >
                              {isDownloaded ? 'Ready' : 'Preview'}
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 500,
                              fontFamily: 'monospace',
                              color: isDark ? '#E6EDF3' : '#0F172A',
                              overflowWrap: 'anywhere',
                              wordBreak: 'break-word',
                              lineHeight: 1.4,
                            }}
                          >
                            {previewFileName}
                          </span>
                        </div>
                      );
                    })()}

                    {/* 1. Prompt Section (Boxless) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '1rem', borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #F1F5F9' }}>
                      <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: isDark ? '#8B949E' : '#64748B' }}>
                        Prompt
                      </label>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FiFileText size={15} style={{ color: isDark ? '#8B949E' : '#64748B', flexShrink: 0 }} />
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: isDark ? '#F0F6FC' : '#0F172A' }}>
                          Connected Prompt
                        </span>
                      </div>

                      <div style={{ paddingLeft: '23px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {/* Upstream AI Model display (Clean, Read-only / Disabled display in Main Box) */}
                        {promptSourceMode === 'upstream_ai' && (() => {
                          const selectedPromptOption = effectiveUpstreamPrompts.find((p) => p.id === selectedUpstreamAiId) || effectiveUpstreamPrompts[0];
                          const displayPromptName = selectedPromptOption ? `${selectedPromptOption.title} (AI Model)` : 'BoltHaven-FB Hero Prompt (AI Model)';
                          return (
                            <div
                              style={{
                                height: '34px',
                                borderRadius: '6px',
                                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#F8FAFC',
                                border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #E2E8F0',
                                padding: '0 12px',
                                display: 'flex',
                                alignItems: 'center',
                                fontSize: '0.8125rem',
                                fontWeight: 500,
                                color: isDark ? '#C9D1D9' : '#334155',
                                userSelect: 'none',
                              }}
                            >
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {displayPromptName}
                              </span>
                            </div>
                          );
                        })()}

                        {/* Custom Prompt Mode */}
                        {promptSourceMode === 'custom' && (
                          <textarea
                            rows={2}
                            value={customPromptText}
                            onChange={(e) => {
                              setCustomPromptText(e.target.value);
                              updateMultiConfig({
                                browserCustomPrompt: e.target.value,
                                customPrompt: e.target.value,
                              });
                            }}
                            placeholder="Enter custom image generation instructions..."
                            style={{
                              width: '100%',
                              padding: '6px 8px',
                              fontSize: '0.6875rem',
                              borderRadius: '6px',
                              border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #CBD5E1',
                              backgroundColor: isDark ? '#25282B' : '#FFFFFF',
                              color: isDark ? '#F0F6FC' : '#0F172A',
                              resize: 'vertical',
                              boxSizing: 'border-box',
                              outline: 'none',
                            }}
                          />
                        )}
                      </div>
                    </div>

                    {/* 2. Attached Images Section (Boxless) */}
                    {((boxConfig.useReferenceImage !== false) || (boxConfig.useCondoImages !== false)) && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: isDark ? '#8B949E' : '#64748B' }}>
                            Attached Images
                          </span>
                          <span style={{ fontSize: '0.625rem', color: isDark ? '#8B949E' : '#64748B' }}>
                            {(boxConfig.useReferenceImage !== false && referenceImage ? 1 : 0) + (boxConfig.useCondoImages !== false ? attachmentSteps.filter((s: AttachmentStep) => s.enabled).reduce((a: number, b: AttachmentStep) => a + b.count, 0) : 0)} total photos
                          </span>
                        </div>

                        {/* Reference Layout (Boxless) */}
                        {boxConfig.useReferenceImage !== false && renderReferenceImageCard()}

                        {/* Condo Photos Multi-Group Manager (Boxless) */}
                        {boxConfig.useCondoImages !== false && (
                          <AttachmentGroupsManager
                            boxless={true}
                            hideToggle={true}
                            hideAddGroup={true}
                            hideDeleteGroup={true}
                            isMainBox={true}
                            steps={attachmentSteps}
                            onChange={handleAttachmentStepsChange}
                            isDark={isDark}
                            useCondoImages={true}
                            onToggleUseCondoImages={() => { }}
                            workflowImageSources={effectiveWorkflowImageSources}
                            propertyImages={propertyContext?.images}
                            enhancedImages={availableEnhancedPhotos}
                            condoName={
                              (condoName || condoSearchQuery || aiExtractedCondoName || matchedCondoInfo?.matched_folder || boxConfig.browserCondoName || boxConfig.condoFolderName || '').trim()
                            }
                          />
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* ── MODULES FOR ENHANCE NODE (When not in Hero mode) ── */}
                {!isHeroNode && (
                  <>
                    {Boolean(boxConfig.showImagesToEnhance) && renderImagesToEnhanceCard()}
                    {boxConfig.usePromptConfig !== false && boxConfig.showEnhancementPrompt !== false && (
                      <div
                        style={{
                          borderRadius: '12px',
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#FFFFFF',
                          border: '1px solid var(--border-color)',
                          padding: '0.875rem 1rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.65rem',
                          boxShadow: isDark ? '0 1px 3px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.05)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                            <div
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '7px',
                                backgroundColor: 'rgba(59, 130, 246, 0.12)',
                                color: '#3B82F6',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <FiFileText size={14} />
                            </div>
                            <div>
                              <div style={{ fontSize: '0.78125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                Enhancement Prompt
                              </div>
                              <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                                Worker tab enhancement template
                              </div>
                            </div>
                          </div>
                        </div>

                        <Select
                          options={promptOptions.map((p) => ({
                            value: p.id,
                            label: p.name,
                          }))}
                          value={effectivePromptKey}
                          onChange={(val) => {
                            const strVal = String(val);
                            setSelectedPromptKey(strVal);
                            const found = promptOptions.find(
                              (p) => String(p.id).trim().toLowerCase() === strVal.trim().toLowerCase() || p.name.trim().toLowerCase() === strVal.trim().toLowerCase()
                            );
                            const txt = found ? found.instructions : '';
                            updateMultiConfig({
                              browserPromptTemplateKey: strVal,
                              ...(txt ? { browserPromptText: txt } : {}),
                            });
                          }}
                        />
                      </div>
                    )}
                  </>
                )}



                {/* ── 4. Generated Hero Advertisement Preview Card ── */}
                {latestHeroImage && isImageRelevantToThisNode(latestHeroImage, boxConfig, targetGroupName) && Boolean(latestHeroImage.fileName?.toLowerCase().includes('hero')) && Boolean(condoName || condoSearchQuery) && Boolean(
                  latestHeroImage.condoName && (
                    (condoName || condoSearchQuery).toLowerCase().includes(latestHeroImage.condoName.toLowerCase()) ||
                    latestHeroImage.condoName.toLowerCase().includes((condoName || condoSearchQuery).toLowerCase())
                  )
                ) && (!effectiveListingCode || (latestHeroImage.fileName && latestHeroImage.fileName.toLowerCase().includes(effectiveListingCode.toLowerCase()))) && (
                    <div
                      style={{
                        borderRadius: '12px',
                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#FFFFFF',
                        border: isDark ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(16, 185, 129, 0.4)',
                        padding: '0.875rem 1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.65rem',
                        boxShadow: isDark ? '0 2px 10px rgba(0,0,0,0.3)' : '0 2px 8px rgba(16, 185, 129, 0.12)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                          <div
                            style={{
                              width: '26px',
                              height: '26px',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(16, 185, 129, 0.15)',
                              color: '#10B981',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <FiCheckCircle size={14} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: '0.78125rem',
                                fontWeight: 700,
                                color: isDark ? '#F3F4F6' : '#1E293B',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {(boxConfig.title || '').toLowerCase().includes('tiktok') ? 'Generated TikTok Hero Image' : 'Generated Hero Image'}
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
                              {latestHeroImage.condoName || condoName || ((boxConfig.title || '').toLowerCase().includes('tiktok') ? 'TikTok Hero' : 'Facebook Hero')}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              fontSize: '0.625rem',
                              fontWeight: 700,
                              color: '#10B981',
                              backgroundColor: 'rgba(16, 185, 129, 0.12)',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              border: '1px solid rgba(16, 185, 129, 0.25)',
                              flexShrink: 0,
                            }}
                          >
                            ✓ Downloaded
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              updateLatestHeroImage(null);
                              localStorage.removeItem(`bolthaven_hero_image_${boxConfig.id}`);
                              localStorage.removeItem('bolthaven_last_hero_image');
                              fetch('http://127.0.0.1:9224/two-stage-status', { method: 'DELETE' }).catch(() => { });
                            }}
                            title="Clear / Dismiss preview"
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: 'var(--text-muted)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '2px',
                              borderRadius: '4px',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = '#EF4444')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                          >
                            <FiX size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Hero Image Thumbnail with Click-to-Open */}
                      <div
                        style={{
                          position: 'relative',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #E2E8F0',
                          backgroundColor: '#0a0a0a',
                          cursor: 'pointer',
                          maxHeight: '190px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        onClick={() => {
                          const resolvedHeroFilePath =
                            latestHeroImage.filePath ||
                            twoStageStatus?.downloaded_file_path ||
                            (latestHeroImage.fileName
                              ? `/Users/zinwaishine/Desktop/Project_EA/backend/storage/uploads/facebook-import/enhanced/${latestHeroImage.fileName}`
                              : '');
                          setPreviewModalImage({
                            url: latestHeroImage.url,
                            fileName: latestHeroImage.fileName,
                            filePath: resolvedHeroFilePath,
                            title: (boxConfig.title || '').toLowerCase().includes('tiktok') ? 'Generated TikTok Hero Image' : 'Generated Hero Image',
                            condoName: latestHeroImage.condoName || condoName,
                          });
                        }}
                      >
                        <img
                          src={latestHeroImage.url}
                          alt="Generated Facebook Hero"
                          style={{
                            width: '100%',
                            height: 'auto',
                            maxHeight: '190px',
                            objectFit: 'contain',
                            display: 'block',
                          }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            padding: '4px 8px',
                            background: 'linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0.3) 70%, transparent)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: '0.5625rem',
                            color: '#FFFFFF',
                          }}
                        >
                          <span
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '75%',
                            }}
                          >
                            {latestHeroImage.fileName || 'fb_hero.png'}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
                            <FiMaximize2 size={10} /> View Full
                          </span>
                        </div>
                      </div>

                      {/* File Path / Location Box */}
                      {(() => {
                        const resolvedHeroFilePath =
                          latestHeroImage.filePath ||
                          twoStageStatus?.downloaded_file_path ||
                          (latestHeroImage.fileName
                            ? `/Users/zinwaishine/Desktop/Project_EA/backend/storage/uploads/facebook-import/enhanced/${latestHeroImage.fileName}`
                            : '');
                        if (!resolvedHeroFilePath) return null;
                        return (
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px',
                              padding: '6px 8px',
                              borderRadius: '6px',
                              backgroundColor: isDark ? 'rgba(0, 0, 0, 0.35)' : '#F1F5F9',
                              border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #CBD5E1',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                fontSize: '0.625rem',
                                color: 'var(--text-secondary)',
                              }}
                            >
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                                <FiFolder size={11} style={{ color: 'var(--accent-primary, #2563EB)' }} />
                                <span>File Path:</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(resolvedHeroFilePath);
                                  setCopiedHeroPath(true);
                                  setTimeout(() => setCopiedHeroPath(false), 2000);
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: copiedHeroPath ? '#10B981' : 'var(--text-muted)',
                                  fontSize: '0.625rem',
                                  fontWeight: 600,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  padding: '1px 4px',
                                  borderRadius: '4px',
                                }}
                                title="Copy file path"
                              >
                                {copiedHeroPath ? <FiCheck size={10} /> : <FiCopy size={10} />}
                                <span>{copiedHeroPath ? 'Copied' : 'Copy'}</span>
                              </button>
                            </div>
                            <div
                              title={`Click to reveal file in Finder: ${resolvedHeroFilePath}`}
                              onClick={() => {
                                fetch(`http://127.0.0.1:9224/reveal-file?file=${encodeURIComponent(latestHeroImage.fileName || '')}`).catch(() => { });
                              }}
                              style={{
                                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                                fontSize: '0.59375rem',
                                color: isDark ? '#93C5FD' : '#1D4ED8',
                                wordBreak: 'break-all',
                                lineHeight: 1.35,
                                cursor: 'pointer',
                                padding: '4px 6px',
                                borderRadius: '4px',
                                backgroundColor: isDark ? 'rgba(37, 99, 235, 0.1)' : 'rgba(37, 99, 235, 0.06)',
                                border: isDark ? '1px solid rgba(37, 99, 235, 0.2)' : '1px solid rgba(37, 99, 235, 0.12)',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = isDark ? 'rgba(37, 99, 235, 0.18)' : 'rgba(37, 99, 235, 0.12)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = isDark ? 'rgba(37, 99, 235, 0.1)' : 'rgba(37, 99, 235, 0.06)';
                              }}
                            >
                              {resolvedHeroFilePath}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            const resolvedHeroFilePath =
                              latestHeroImage.filePath ||
                              twoStageStatus?.downloaded_file_path ||
                              (latestHeroImage.fileName
                                ? `/Users/zinwaishine/Desktop/Project_EA/backend/storage/uploads/facebook-import/enhanced/${latestHeroImage.fileName}`
                                : '');
                            setPreviewModalImage({
                              url: latestHeroImage.url,
                              fileName: latestHeroImage.fileName,
                              filePath: resolvedHeroFilePath,
                              title: (boxConfig.title || '').toLowerCase().includes('tiktok') ? 'Generated TikTok Hero Image' : 'Generated Hero Image',
                              condoName: latestHeroImage.condoName || condoName,
                            });
                          }}
                          style={{
                            flex: 1,
                            height: '30px',
                            borderRadius: '8px',
                            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
                            border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                            color: isDark ? '#F3F4F6' : '#1E293B',
                            fontSize: '0.6875rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '5px',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9';
                          }}
                        >
                          <FiMaximize2 size={12} /> <span>Open Full Size</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            fetch(`http://127.0.0.1:9224/reveal-file?file=${encodeURIComponent(latestHeroImage.fileName || '')}`).catch(() => { });
                          }}
                          style={{
                            flex: 1,
                            height: '30px',
                            borderRadius: '8px',
                            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
                            border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                            color: isDark ? '#F3F4F6' : '#1E293B',
                            fontSize: '0.6875rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '5px',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9';
                          }}
                        >
                          <FiFolder size={12} /> <span>Reveal in Finder</span>
                        </button>
                      </div>
                    </div>
                  )}
              </div>
            ) : (
              /* ═════════════════════════════════════════════════════════════════════ */
              /* STANDARD WORKER TAB GROUP (e.g. ENHANCE IMG 4 TABS)                 */
              /* ═════════════════════════════════════════════════════════════════════ */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* 1. Images to Enhance Card */}
                {boxConfig.showImagesToEnhance !== false && renderImagesToEnhanceCard()}

                {/* 2. Enhancement Prompt Card */}
                {boxConfig.showEnhancementPrompt !== false && boxConfig.usePromptConfig !== false && (
                  <div
                    style={{
                      borderRadius: '12px',
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#FFFFFF',
                      border: '1px solid var(--border-color)',
                      padding: '0.875rem 1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.65rem',
                      boxShadow: isDark ? '0 1px 3px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.05)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                        <div
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '7px',
                            backgroundColor: 'rgba(59, 130, 246, 0.12)',
                            color: '#3B82F6',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <FiFileText size={14} />
                        </div>
                        <div>
                          <div style={{ fontSize: '0.78125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            Enhancement Prompt
                          </div>
                          <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                            {promptSourceMode === 'custom'
                              ? 'Custom Prompt Override'
                              : `${promptOptions.find((p) => String(p.id).toLowerCase() === selectedPromptKey.toLowerCase())?.name || 'Preset Enhancement Template'}`}
                          </div>
                        </div>
                      </div>

                      <span
                        style={{
                          fontSize: '0.5625rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '10px',
                          backgroundColor: promptSourceMode === 'custom' ? 'rgba(139, 92, 246, 0.15)' : (isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9'),
                          color: promptSourceMode === 'custom' ? '#8B5CF6' : 'var(--text-secondary)',
                          border: promptSourceMode === 'custom' ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid var(--border-color)',
                          letterSpacing: '0.02em',
                        }}
                      >
                        {promptSourceMode === 'custom' ? 'Custom' : 'Preset'}
                      </span>
                    </div>

                    {/* Clean Read-Only Display of Active Prompt Template (Configured in Settings) */}
                    <div
                      style={{
                        height: '34px',
                        borderRadius: '6px',
                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#F8FAFC',
                        border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #E2E8F0',
                        padding: '0 12px',
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: '0.8125rem',
                        fontWeight: 500,
                        color: isDark ? '#C9D1D9' : '#334155',
                        userSelect: 'none',
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {promptSourceMode === 'custom'
                          ? (customPromptText || 'Custom Prompt')
                          : (promptOptions.find((p) => String(p.id).toLowerCase() === selectedPromptKey.toLowerCase())?.name || 'Enhance Image')}
                      </span>
                    </div>

                    {/* View Prompt Button & Quick Copy Button */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          onCloseSettingsSidebox?.();
                          setShowPromptViewSidebox(true);
                        }}
                        style={{
                          flex: 1,
                          height: '32px',
                          borderRadius: '8px',
                          border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
                          color: 'var(--text-primary)',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9';
                        }}
                      >
                        <FiFileText size={13} style={{ color: 'var(--text-secondary)' }} />
                        <span>View Prompt Template</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleCopyPrompt}
                        title="Copy full prompt"
                        style={{
                          height: '32px',
                          padding: '0 12px',
                          borderRadius: '8px',
                          border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
                          color: isCopied ? '#10B981' : 'var(--text-secondary)',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9';
                        }}
                      >
                        {isCopied ? <FiCheck size={12} /> : <FiCopy size={12} />}
                        <span>{isCopied ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>

                    {/* Auto-Run Toggle & Status Bar (Integrated inside Enhancement Prompt Box) */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        background: autoRunEnabled ? 'rgba(16, 185, 129, 0.08)' : isDark ? 'rgba(255, 255, 255, 0.03)' : '#F8FAFC',
                        border: autoRunEnabled ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid var(--border-color)',
                        marginTop: '4px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          style={{
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            backgroundColor: autoRunEnabled ? '#10B981' : '#94A3B8',
                            boxShadow: autoRunEnabled ? '0 0 8px rgba(16, 185, 129, 0.6)' : 'none',
                          }}
                        />
                        <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: autoRunEnabled ? '#10B981' : 'var(--text-secondary)' }}>
                          {autoRunCountdown !== null
                            ? `⚡ Auto-starting in ${autoRunCountdown}s...`
                            : autoRunEnabled
                              ? 'Auto-Run: Active (Auto-runs tabs & photos)'
                              : 'Auto-Run: Off (Manual click)'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {autoRunCountdown !== null && (
                          <button
                            type="button"
                            onClick={handleCancelAutoRun}
                            style={{
                              border: 'none',
                              background: 'rgba(239, 68, 68, 0.12)',
                              color: '#EF4444',
                              fontSize: '0.625rem',
                              fontWeight: 600,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                            }}
                          >
                            Cancel
                          </button>
                        )}
                        <ToggleSwitch
                          checked={autoRunEnabled}
                          onChange={(val) => handleToggleAutoRun(val)}
                          size="sm"
                          activeColor="#10B981"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* If missing photos exist from previous run, provide 1-click clean "Resume Missing Photos" button */}
            {missingPositions.length > 0 && enhancedImages.length > 0 && !isAutomating && !isRunningTwoStage && !isHeroNode && (
              <button
                type="button"
                onClick={() => {
                  setSelectedGroupName(currentGroup.name || boxConfig.browserGroupName || 'Enhance IMG');
                  handleStartGroupAutomation(missingPositions);
                }}
                style={{
                  width: '100%',
                  height: '36px',
                  borderRadius: '6px',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  backgroundColor: 'rgba(245, 158, 11, 0.09)',
                  color: '#F59E0B',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  marginBottom: '6px',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.18)';
                  e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.45)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.09)';
                  e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.3)';
                }}
                title={`Queue and enhance missing photos: ${missingPositions.map((p) => '#' + p).join(', ')}`}
              >
                <FiPlay size={12} />
                <span>Resume Missing Photos ({missingPositions.length})</span>
              </button>
            )}
          </div>

          {/* SECTION C — CHROME TAB GROUPS MULTI-PIPELINE (RELATIVE TO SELECTED PROFILE) */}
          {boxConfig.showTabGroupsPipelines !== false && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FiLayers style={{ color: 'var(--text-muted)' }} /> Tab Groups & Pipelines ({activeProfile?.display_name || 'Chrome'})
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const profId = activeProfile?.id || selectedProfileId;
                    const profKey = activeProfile?.profile_key || boxConfig.browserProfileKey || (profiles[0]?.profile_key || 'Pro');
                    const profName = activeProfile?.display_name || boxConfig.browserProfileName || (profiles[0]?.display_name || 'Note Zin Wai');
                    if (profId) {
                      fetchTabGroups(profId, profKey, profName).then((g) => setTabGroups(g));
                    }
                  }}
                  style={{
                    height: '26px',
                    padding: '0 8px',
                    borderRadius: '8px',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
                    color: 'var(--text-secondary)',
                    fontSize: '0.6875rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                >
                  <FiRefreshCw size={11} />
                  <span>Refresh Groups</span>
                </button>
              </div>

              {displayGroups.length === 0 ? (
                <div
                  style={{
                    padding: '0.85rem',
                    borderRadius: '8px',
                    border: '1px dashed var(--border-color)',
                    textAlign: 'center',
                    fontSize: '0.6875rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  No tab groups discovered for &ldquo;{activeProfile?.display_name || 'Selected Profile'}&rdquo;.
                  <br />
                  Create or focus tab groups in Chrome (e.g. &ldquo;Enhance IMG&rdquo;, &ldquo;FB Hero&rdquo;).
                </div>
              ) : (
                displayGroups.map((group, groupIdx) => {
                  const isEnhance = group.name.toLowerCase().includes('enhance');
                  const isHero = isHeroNode || group.name.toLowerCase().includes('hero') || group.name.toLowerCase().includes('fb');
                  const groupBg = isDark ? '#25282B' : '#F8FAFC';
                  const groupBorder = isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid var(--border-color)';
                  const allGroupTabs = group.tabs || [];
                  // FB Hero pipeline: Direct mode uses exactly 1 tab, 2-Stage uses 2. Show only the tabs actually used.
                  const isDirectHeroPipeline = boxConfig.stagingMode === 'direct_tab2' || boxConfig.skipTab1 === true;
                  const pipelineTabLimit = isHero ? (isDirectHeroPipeline ? 1 : 2) : (boxConfig.workerTabCount || allGroupTabs.length);
                  const tabs = allGroupTabs.slice(0, Math.max(1, pipelineTabLimit));

                  return (
                    <div
                      key={group.id || group.name || groupIdx}
                      style={{
                        padding: '0.75rem 0.875rem',
                        borderRadius: '8px',
                        backgroundColor: groupBg,
                        border: groupBorder,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                      }}
                    >
                      {/* Group Title Header */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--text-muted)' }} />
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {group.name}
                          </span>
                          <span
                            style={{
                              fontSize: '0.5625rem',
                              padding: '1px 6px',
                              borderRadius: '10px',
                              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                              color: 'var(--text-secondary)',
                              fontWeight: 600,
                            }}
                          >
                            {tabs.length} {tabs.length === 1 ? 'Tab' : 'Tabs'}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={async () => {
                            if (tabs.length > 0) {
                              try {
                                const isHeroGrp = isHeroNode || (group.name || '').toLowerCase().includes('hero') || (group.name || '').toLowerCase().includes('fb');
                                const grpCount = isHeroGrp ? (boxConfig.stagingMode === 'direct_tab2' ? 1 : 2) : (boxConfig.workerTabCount || tabs.length || 4);
                                await focusBrowserTabGroup({
                                  profileId: activeProfile?.id || selectedProfileId,
                                  profileKey: activeProfile?.profile_key || boxConfig.browserProfileKey || (profiles[0]?.profile_key || 'Pro'),
                                  groupName: group.name,
                                  tabId: tabs[0].id,
                                  groupTabUrls: tabs.map((t) => t.url).filter(Boolean).slice(0, grpCount),
                                  url: tabs[0].url,
                                  workerCount: grpCount,
                                  force: true,
                                });
                              } catch (e) { }
                            }
                          }}
                          style={{
                            height: '24px',
                            padding: '0 8px',
                            borderRadius: '8px',
                            border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
                            color: 'var(--text-secondary)',
                            fontSize: '0.6875rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0';
                            e.currentTarget.style.color = 'var(--text-primary)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9';
                            e.currentTarget.style.color = 'var(--text-secondary)';
                          }}
                        >
                          <FiExternalLink size={11} />
                          <span>Focus Group</span>
                        </button>
                      </div>

                      {/* Worker Tabs in this Group (Clean Compact Grid) */}
                      {tabs.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '2px' }}>
                          <div style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                            Pipeline workers ({tabs.length} live {tabs.length === 1 ? 'tab' : 'tabs'}):
                          </div>
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: tabs.length > 1 ? 'repeat(2, 1fr)' : '1fr',
                              gap: '6px',
                            }}
                          >
                            {tabs.map((tab, idx) => (
                              <div
                                key={tab.id || idx}
                                title={`${tab.title || `Worker Tab #${idx + 1}`}\n${tab.url || ''}`}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '5px 8px',
                                  borderRadius: '6px',
                                  backgroundColor: isDark ? 'rgba(0, 0, 0, 0.25)' : '#FFFFFF',
                                  border: '1px solid var(--border-color)',
                                  minWidth: 0,
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                                  <div
                                    style={{
                                      width: '16px',
                                      height: '16px',
                                      borderRadius: '50%',
                                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
                                      color: 'var(--text-primary)',
                                      fontSize: '0.5625rem',
                                      fontWeight: 700,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      flexShrink: 0,
                                    }}
                                  >
                                    {idx + 1}
                                  </div>
                                  <span
                                    style={{
                                      fontSize: '0.6875rem',
                                      fontWeight: 600,
                                      color: 'var(--text-primary)',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    Worker #{idx + 1}
                                  </span>
                                </div>
                                <div
                                  style={{
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    background: '#10B981',
                                    boxShadow: '0 0 4px #10B981',
                                    flexShrink: 0,
                                    marginLeft: '4px',
                                  }}
                                  title="Tab Active"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {/* Global Automation Messages */}
              {(automationMessage || twoStageMessage) && (
                <div
                  style={{
                    padding: '0.45rem 0.6rem',
                    borderRadius: '6px',
                    fontSize: '0.625rem',
                    backgroundColor: isDark ? 'rgba(0, 0, 0, 0.2)' : '#F1F5F9',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    maxWidth: '100%',
                    boxSizing: 'border-box',
                  }}
                >
                  <FiCheckCircle size={12} style={{ color: '#10B981', flexShrink: 0 }} />
                  <span style={{ minWidth: 0, flex: 1, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{automationMessage || twoStageMessage}</span>
                </div>
              )}
            </div>
          )}

          {/* SECTION: ENHANCED IMAGES RESULTS (Downloaded to Disk) */}
          {!isHeroNode && receivedImages.length > 0 && enhancedImages.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.625rem',
                padding: '0.75rem',
                borderRadius: '10px',
                backgroundColor: isDark ? 'rgba(16, 185, 129, 0.06)' : 'rgba(16, 185, 129, 0.05)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
              }}
            >
              {/* Header Row: Title & Status */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '6px 8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                  <div
                    style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      backgroundColor: missingPositions.length > 0 && enhancedImages.length === 0 ? '#F59E0B' : '#10B981',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {missingPositions.length > 0 && enhancedImages.length === 0 ? '!' : '✓'}
                  </div>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Enhanced Images ({enhancedImages.length}
                    {activeImages.length > 0 && enhancedImages.length < activeImages.length ? ` of ${activeImages.length}` : ''} Photos)
                  </span>
                  {missingPositions.length > 0 && (
                    <span
                      style={{
                        fontSize: '0.625rem',
                        fontWeight: 600,
                        padding: '1px 5px',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(245, 158, 11, 0.12)',
                        color: '#F59E0B',
                        border: '1px solid rgba(245, 158, 11, 0.25)',
                      }}
                    >
                      {missingPositions.length} Missing
                    </span>
                  )}
                </div>

                {/* When NO missing photos exist, quick actions sit right in header */}
                {missingPositions.length === 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap', flexShrink: 0 }}>
                    {enhancedImages.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setOrderDraft([...enhancedImages]);
                          setShowOrderModal(true);
                        }}
                        style={{
                          height: '24px',
                          padding: '0 8px',
                          fontSize: '0.6875rem',
                          fontWeight: 500,
                          borderRadius: '5px',
                          border: '1px solid rgba(59, 130, 246, 0.35)',
                          backgroundColor: 'rgba(59, 130, 246, 0.12)',
                          color: '#60A5FA',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                      >
                        <span>⇅ Order</span>
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isRegettingImages}
                      onClick={handleRegetEnhancedImages}
                      style={{
                        height: '24px',
                        padding: '0 8px',
                        fontSize: '0.6875rem',
                        fontWeight: 500,
                        borderRadius: '5px',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        backgroundColor: 'rgba(255, 255, 255, 0.04)',
                        color: regetFeedback ? '#10B981' : 'var(--text-secondary)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                        e.currentTarget.style.color = 'var(--text-primary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                        e.currentTarget.style.color = regetFeedback ? '#10B981' : 'var(--text-secondary)';
                      }}
                    >
                      <FiRefreshCw size={10} className={isRegettingImages ? 'animate-spin' : ''} />
                      <span>{regetFeedback || 'Sync'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        fetch('http://127.0.0.1:9224/reveal-file').catch(() => { });
                      }}
                      style={{
                        height: '24px',
                        padding: '0 8px',
                        fontSize: '0.6875rem',
                        fontWeight: 500,
                        borderRadius: '5px',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        backgroundColor: 'rgba(255, 255, 255, 0.04)',
                        color: 'var(--text-secondary)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                        e.currentTarget.style.color = 'var(--text-primary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                      }}
                    >
                      <FiFolder size={11} style={{ color: '#10B981' }} />
                      <span>Downloads</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Clean Action Toolbar (Visible when missing photos exist) */}
              {missingPositions.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    paddingTop: '2px',
                  }}
                >
                  {/* 1. Resume / Regenerate Missing Photos */}
                  {!isAutomating && !isRunningTwoStage && !isHeroNode && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedGroupName(currentGroup.name || boxConfig.browserGroupName || 'Enhance IMG');
                        handleStartGroupAutomation(missingPositions);
                      }}
                      style={{
                        height: '26px',
                        padding: '0 9px',
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        borderRadius: '5px',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        color: '#F59E0B',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.18)';
                        e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.45)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.1)';
                        e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.3)';
                      }}
                      title={`Queue & enhance ${missingPositions.length} missing photo(s): ${missingPositions.map((p) => '#' + p).join(', ')}`}
                    >
                      <FiPlay size={10} />
                      <span>Resume ({missingPositions.length})</span>
                    </button>
                  )}

                  {/* 2. Recover from Disk */}
                  {enhancedImages.length > 0 && !isAutomating && !isRunningTwoStage && (
                    <button
                      type="button"
                      disabled={isRecovering}
                      onClick={async () => {
                        setIsRecovering(true);
                        try {
                          await fetch('http://127.0.0.1:9224/recover-missing-images', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              property_id: propertyContext?.id || '',
                              propertyId: propertyContext?.id || '',
                              listing_code: (propertyContext?.listingCode || '').trim(),
                              listingCode: (propertyContext?.listingCode || '').trim(),
                              targetPositions: missingPositions,
                              autoWorkMissing: false,
                            }),
                          });
                          for (let i = 0; i < 6; i++) {
                            await new Promise((r) => setTimeout(r, 1000));
                            const refreshedList = await fetchEnhancedDownloadedImages(propertyContext?.id, propertyContext?.listingCode);
                            if (refreshedList && refreshedList.length > 0) {
                              const refreshedPositions = new Set(refreshedList.map((img) => img.position));
                              const remainingMissing = missingPositions.filter((p) => !refreshedPositions.has(p));
                              if (remainingMissing.length === 0) {
                                const newTs = Date.now();
                                setCacheBustTimestamp(newTs);
                                const cacheBusted = refreshedList.map((img) => ({
                                  ...img,
                                  url: img.url.includes('?') ? `${img.url}&_cb=${newTs}` : `${img.url}?_cb=${newTs}`,
                                }));
                                const { sorted, hasCustomOrder } = sortEnhancedByCustomOrder(
                                  cacheBusted,
                                  (boxConfig as any).enhancedImagesOrder
                                );
                                lastEnhancedSigRef.current = sorted
                                  .map((img) => `${img.position}:${img.backend_url || img.url}:${(img as any).size_bytes || (img as any).size || ''}`)
                                  .join('|');
                                setEnhancedImages(sorted);
                                if (onEnhancedPhotosUpdate) {
                                  onEnhancedPhotosUpdate(buildEnhancedPhotoMap(sorted, hasCustomOrder));
                                }
                                break;
                              }
                            }
                          }
                          await loadQueue();
                        } catch (e) {
                          console.warn('Recovery error:', e);
                        } finally {
                          setIsRecovering(false);
                        }
                      }}
                      style={{
                        height: '26px',
                        padding: '0 9px',
                        fontSize: '0.6875rem',
                        fontWeight: 500,
                        borderRadius: '5px',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        backgroundColor: 'rgba(255, 255, 255, 0.04)',
                        color: 'var(--text-secondary)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                        e.currentTarget.style.color = 'var(--text-primary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                      }}
                      title={`Missing ${missingPositions.length} photo(s): ${missingPositions.map((p) => `#${p}`).join(', ')}. Click to recover missing photos from disk.`}
                    >
                      <FiRefreshCw size={10} style={{ color: '#F87171' }} className={isRecovering ? 'animate-spin' : ''} />
                      <span>Recover ({missingPositions.length})</span>
                    </button>
                  )}

                  {/* 3. Re-get / Sync */}
                  <button
                    type="button"
                    disabled={isRegettingImages}
                    onClick={handleRegetEnhancedImages}
                    style={{
                      height: '26px',
                      padding: '0 9px',
                      fontSize: '0.6875rem',
                      fontWeight: 500,
                      borderRadius: '5px',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      backgroundColor: 'rgba(255, 255, 255, 0.04)',
                      color: regetFeedback ? '#10B981' : 'var(--text-secondary)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                      e.currentTarget.style.color = regetFeedback ? '#10B981' : 'var(--text-secondary)';
                    }}
                    title="Re-get and sync all enhanced photos from your drive / downloads"
                  >
                    <FiRefreshCw size={10} className={isRegettingImages ? 'animate-spin' : ''} />
                    <span>{regetFeedback || 'Sync'}</span>
                  </button>

                  {/* 4. Downloads folder */}
                  <button
                    type="button"
                    onClick={() => {
                      fetch('http://127.0.0.1:9224/reveal-file').catch(() => { });
                    }}
                    style={{
                      height: '26px',
                      padding: '0 9px',
                      fontSize: '0.6875rem',
                      fontWeight: 500,
                      borderRadius: '5px',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      backgroundColor: 'rgba(255, 255, 255, 0.04)',
                      color: 'var(--text-secondary)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                    title="Open Downloads folder in macOS Finder"
                  >
                    <FiFolder size={11} style={{ color: '#10B981' }} />
                    <span>Downloads</span>
                  </button>
                </div>
              )}

              {/* Grid of Enhanced and Missing Images */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: '6px',
                  maxHeight: '420px',
                  overflowY: 'auto',
                  paddingRight: '2px',
                }}
              >
                {(() => {
                  const enhancedMap = new Map<number, EnhancedDownloadedImage>();
                  enhancedImages.forEach((img) => enhancedMap.set(img.position || 1, img));

                  const cardItems: Array<{
                    position: number;
                    enhanced?: EnhancedDownloadedImage;
                    sourceImage?: { url: string; index?: number };
                    isMissing: boolean;
                  }> = [];

                  const hasCustomOrder = Array.isArray((boxConfig as any).enhancedImagesOrder) && (boxConfig as any).enhancedImagesOrder.length > 0;
                  if (hasCustomOrder && !isHeroNode) {
                    enhancedImages.forEach((enh, idx) => {
                      cardItems.push({
                        position: enh.position || idx + 1,
                        enhanced: enh,
                        isMissing: false,
                      });
                    });
                    activeImages.forEach((srcImg, idx) => {
                      const pos = typeof srcImg.index === 'number' && srcImg.index > 0 ? srcImg.index : idx + 1;
                      if (!enhancedMap.has(pos)) {
                        cardItems.push({ position: pos, sourceImage: srcImg, isMissing: true });
                      }
                    });
                  } else if (activeImages.length > 0 && !isHeroNode) {
                    activeImages.forEach((srcImg, idx) => {
                      const pos = typeof srcImg.index === 'number' && srcImg.index > 0 ? srcImg.index : idx + 1;
                      const enh = enhancedMap.get(pos);
                      cardItems.push({
                        position: pos,
                        enhanced: enh,
                        sourceImage: srcImg,
                        isMissing: !enh,
                      });
                    });
                  } else {
                    enhancedImages.forEach((enh, idx) => {
                      cardItems.push({
                        position: enh.position || idx + 1,
                        enhanced: enh,
                        isMissing: false,
                      });
                    });
                  }

                  return cardItems.map((item) => {
                    if (item.isMissing) {
                      return (
                        <div
                          key={`missing-pos-${item.position}`}
                          style={{
                            position: 'relative',
                            borderRadius: '7px',
                            overflow: 'hidden',
                            border: '1px dashed #F59E0B',
                            backgroundColor: isDark ? '#1E293B' : '#FEF3C7',
                            aspectRatio: '1 / 1',
                            width: '100%',
                          }}
                        >
                          {item.sourceImage?.url && (
                            <img
                              src={item.sourceImage.url}
                              alt={`Photo #${item.position}`}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                display: 'block',
                                opacity: 0.6,
                                filter: 'grayscale(25%)',
                              }}
                            />
                          )}
                          <div
                            style={{
                              position: 'absolute',
                              top: '4px',
                              left: '4px',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              backgroundColor: 'rgba(0, 0, 0, 0.75)',
                              color: '#FFFFFF',
                              fontSize: '0.5625rem',
                              fontWeight: 700,
                              backdropFilter: 'blur(4px)',
                              zIndex: 2,
                            }}
                          >
                            #{item.position}
                          </div>
                          <div
                            style={{
                              position: 'absolute',
                              top: '4px',
                              right: '4px',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              backgroundColor: '#F59E0B',
                              color: '#FFFFFF',
                              fontSize: '0.5625rem',
                              fontWeight: 700,
                              zIndex: 2,
                            }}
                            title="Missing"
                          >
                            !
                          </div>
                          <div
                            style={{
                              position: 'absolute',
                              inset: 0,
                              display: 'flex',
                              alignItems: 'flex-end',
                              justifyContent: 'center',
                              padding: '6px',
                              background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 60%)',
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedGroupName(currentGroup.name || boxConfig.browserGroupName || 'Enhance IMG');
                                handleStartGroupAutomation([item.position]);
                              }}
                              disabled={isAutomating || isRunningTwoStage}
                              style={{
                                background: '#F59E0B',
                                border: 'none',
                                borderRadius: '5px',
                                color: '#000000',
                                fontSize: '0.5625rem',
                                fontWeight: 700,
                                padding: '3px 7px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                              }}
                              title={`Queue & enhance missing Photo #${item.position}`}
                            >
                              <FiPlay size={8} />
                              <span>Retry</span>
                            </button>
                          </div>
                        </div>
                      );
                    }

                    const img = item.enhanced!;
                    const posNum = img.position || item.position;
                    const cardKey = `${img.filename || posNum}-${img.size || 0}-${cacheBustTimestamp}`;
                    const isHovered = hoveredEnhancedCardKey === cardKey;
                    const displayUrl = img.url
                      ? img.url.includes('?')
                        ? `${img.url}&_cb=${cacheBustTimestamp}`
                        : `${img.url}?_cb=${cacheBustTimestamp}`
                      : '';
                    const overlayBtnStyle: React.CSSProperties = {
                      width: '24px',
                      height: '24px',
                      borderRadius: '6px',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      backgroundColor: 'rgba(15, 23, 42, 0.85)',
                      color: '#F8FAFC',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                      backdropFilter: 'blur(6px)',
                      transition: 'transform 0.12s ease, background-color 0.12s ease',
                    };

                    return (
                      <div
                        key={cardKey}
                        onMouseEnter={() => setHoveredEnhancedCardKey(cardKey)}
                        onMouseLeave={() => setHoveredEnhancedCardKey((prev) => (prev === cardKey ? null : prev))}
                        onClick={() => {
                          setPreviewModalImage({
                            url: displayUrl || img.url,
                            fileName: img.filename,
                            title: `Enhanced Photo #${posNum}`,
                            filePath: (img as any).full_path || (img.filename ? `/Users/zinwaishine/Desktop/Project_EA/backend/storage/uploads/facebook-import/enhanced/${img.filename}` : undefined),
                          });
                        }}
                        style={{
                          position: 'relative',
                          borderRadius: '7px',
                          overflow: 'hidden',
                          border: isHovered
                            ? '1px solid rgba(16, 185, 129, 0.6)'
                            : isDark
                              ? '1px solid rgba(255, 255, 255, 0.12)'
                              : '1px solid var(--border-color)',
                          backgroundColor: isDark ? '#1E293B' : '#E2E8F0',
                          aspectRatio: '1 / 1',
                          width: '100%',
                          cursor: 'pointer',
                          transition: 'border-color 0.15s ease',
                        }}
                      >
                        <img
                          src={displayUrl}
                          key={displayUrl}
                          alt={img.filename}
                          loading="eager"
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            display: 'block',
                          }}
                        />

                        {/* Top-left position badge */}
                        <div
                          style={{
                            position: 'absolute',
                            top: '4px',
                            left: '4px',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(0, 0, 0, 0.72)',
                            color: '#FFFFFF',
                            fontSize: '0.5625rem',
                            fontWeight: 700,
                            backdropFilter: 'blur(4px)',
                            zIndex: 2,
                          }}
                        >
                          #{posNum}
                        </div>

                        {/* Top-right compact Enhanced badge */}
                        <div
                          style={{
                            position: 'absolute',
                            top: '4px',
                            right: '4px',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            backgroundColor: '#10B981',
                            color: '#FFFFFF',
                            fontSize: '0.5625rem',
                            fontWeight: 700,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                            zIndex: 2,
                          }}
                          title="Enhanced"
                        >
                          ✓
                        </div>

                        {/* Hover-only action button bar overlaid above image */}
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'flex-end',
                            justifyContent: 'center',
                            gap: '4px',
                            padding: '6px 4px',
                            background: 'linear-gradient(to top, rgba(15, 23, 42, 0.88) 0%, rgba(15, 23, 42, 0.28) 55%, transparent 100%)',
                            opacity: isHovered ? 1 : 0,
                            pointerEvents: isHovered ? 'auto' : 'none',
                            transition: 'opacity 0.15s ease',
                            zIndex: 3,
                          }}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRegetSingleImage(posNum);
                            }}
                            disabled={regettingSinglePos === posNum}
                            style={overlayBtnStyle}
                            title={`Re-get photo #${posNum} from drive`}
                          >
                            <FiRefreshCw
                              size={11}
                              className={regettingSinglePos === posNum ? 'animate-spin' : ''}
                            />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              fetch(`http://127.0.0.1:9224/reveal-file?file=${encodeURIComponent(img.filename)}`).catch(() => { });
                            }}
                            style={overlayBtnStyle}
                            title="Reveal in Finder"
                          >
                            <FiFolder size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewModalImage({
                                url: displayUrl || img.url,
                                fileName: img.filename,
                                title: `Enhanced Photo #${posNum}`,
                                filePath: (img as any).full_path || (img.filename ? `/Users/zinwaishine/Desktop/Project_EA/backend/storage/uploads/facebook-import/enhanced/${img.filename}` : undefined),
                              });
                            }}
                            style={{ ...overlayBtnStyle, color: '#34D399' }}
                            title="View Full Resolution"
                          >
                            <FiMaximize2 size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteEnhancedImage(img);
                            }}
                            disabled={deletingPos === posNum}
                            style={{ ...overlayBtnStyle, color: '#F87171' }}
                            title={`Delete photo #${posNum}`}
                          >
                            <FiTrash2 size={11} />
                          </button>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {/* SECTION G — SMART IMAGE QUEUE */}
          {!isHeroNode && (() => {
            // Strictly show jobs from current property run, or preview images from current "Get Images"
            const currentPropId = propertyContext?.id;
            const matchingQueueJobs = currentPropId
              ? queueJobs.filter((j) => j.property_id === currentPropId)
              : [];

            const displayQueueItems: any[] = matchingQueueJobs.length > 0
              ? matchingQueueJobs
              : (propertyContext?.images || []).map((img, i) => ({
                id: `preview-${i + 1}`,
                job_id: `get-images-photo-${i + 1}`,
                property_id: currentPropId || '',
                original_position: img.index || i + 1,
                status: 'READY_FOR_USER',
                source_file_url: img.url,
                output_file_url: '',
              }));

            if (displayQueueItems.length === 0) return null;

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                  <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    Smart Image Queue ({displayQueueItems.length} Images)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', marginLeft: 'auto' }}>
                    {missingPositions.length > 0 && enhancedImages.length > 0 && !isAutomating && !isRunningTwoStage && !isHeroNode && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedGroupName(currentGroup.name || boxConfig.browserGroupName || 'Enhance IMG');
                          handleStartGroupAutomation(missingPositions);
                        }}
                        style={{
                          height: '24px',
                          padding: '0 8px',
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          borderRadius: '5px',
                          color: '#F59E0B',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                          backgroundColor: 'rgba(245, 158, 11, 0.1)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.18)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.1)';
                        }}
                        title={`Queue & work ${missingPositions.length} missing photos: ${missingPositions.map((p) => '#' + p).join(', ')}`}
                      >
                        <FiPlay size={9} />
                        <span>Run Missing ({missingPositions.length})</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={loadQueue}
                      style={{
                        height: '24px',
                        padding: '0 7px',
                        fontSize: '0.6875rem',
                        borderRadius: '5px',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        backgroundColor: 'rgba(255, 255, 255, 0.04)',
                        color: 'var(--text-secondary)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      title="Refresh Queue"
                    >
                      <FiRefreshCw size={10} />
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: displayQueueItems.length > 1 ? 'repeat(2, 1fr)' : '1fr',
                    gap: '6px',
                  }}
                >
                  {displayQueueItems.map((job) => {
                    const isEnhanced = enhancedImages.some((img) => img.position === job.original_position);
                    const isCompleted = job.status === 'COMPLETED' || isEnhanced;
                    const isMissing = !isCompleted && enhancedImages.length > 0;
                    const isReady = job.status === 'READY_FOR_USER' && !isCompleted && !isMissing;
                    const isLocal = job.status === 'PROCESSING_LOCAL';
                    const isFailed = job.status === 'FAILED';

                    const badgeColor = isCompleted
                      ? '#10B981'
                      : isMissing
                        ? '#F59E0B'
                        : isReady
                          ? '#06B6D4'
                          : isLocal
                            ? '#8B5CF6'
                            : isFailed
                              ? '#EF4444'
                              : '#6B7280';

                    return (
                      <div
                        key={job.id}
                        title={`Image #${job.original_position} · Status: ${isCompleted ? 'COMPLETED' : isMissing ? 'MISSING' : job.status}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '5px 8px',
                          borderRadius: '6px',
                          backgroundColor: isDark ? 'rgba(0, 0, 0, 0.25)' : '#FFFFFF',
                          border: isMissing ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid var(--border-color)',
                          minWidth: 0,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                          <div
                            style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '4px',
                              backgroundColor: isCompleted ? 'rgba(16, 185, 129, 0.15)' : isMissing ? 'rgba(245, 158, 11, 0.15)' : isDark ? '#0F172A' : '#E2E8F0',
                              border: isCompleted ? '1px solid rgba(16, 185, 129, 0.4)' : isMissing ? '1px solid rgba(245, 158, 11, 0.4)' : 'none',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.625rem',
                              fontWeight: 700,
                              color: isCompleted ? '#10B981' : isMissing ? '#F59E0B' : 'var(--text-primary)',
                              flexShrink: 0,
                            }}
                          >
                            {job.original_position}
                          </div>
                          <span
                            style={{
                              fontSize: '0.6875rem',
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Image #{job.original_position}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                          {isMissing && !isAutomating && !isRunningTwoStage && !isHeroNode && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedGroupName(currentGroup.name || boxConfig.browserGroupName || 'Enhance IMG');
                                handleStartGroupAutomation([job.original_position]);
                              }}
                              title={`Queue and enhance Image #${job.original_position} again`}
                              style={{
                                padding: '1px 5px',
                                fontSize: '0.5625rem',
                                fontWeight: 600,
                                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                                color: '#F59E0B',
                                border: '1px solid rgba(245, 158, 11, 0.4)',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px',
                              }}
                            >
                              <FiPlay size={8} />
                              <span>Work</span>
                            </button>
                          )}
                          <span
                            style={{
                              padding: '1px 5px',
                              borderRadius: '4px',
                              fontSize: '0.5625rem',
                              fontWeight: 600,
                              backgroundColor: `${badgeColor}18`,
                              color: badgeColor,
                              border: `1px solid ${badgeColor}33`,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {isCompleted ? 'Done' : isMissing ? 'Missing' : isReady ? 'Ready' : isLocal ? 'Local' : job.status}
                          </span>

                          {job.output_file_url && (
                            <a
                              href={job.output_file_url}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: '#10B981', display: 'flex', alignItems: 'center' }}
                              title="View Enhanced Master"
                            >
                              <FiExternalLink size={10} />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </>
      )}

      {/* ── PINNED FOOTER RUN BUTTON (PORTALED TO TRUE SIDEBAR DRAWER FOOTER) ── */}
      {(() => {
        // Resolve all attached photos in sequence to chat composer
        const allAttachedChatPhotos: Array<{ url: string; label: string; index: number; groupName?: string }> = [];
        let seq = 1;

        if (isEnhanceNode) {
          activeImages.forEach((img, i) => {
            const pos = typeof img.index === 'number' && img.index > 0 ? img.index : i + 1;
            allAttachedChatPhotos.push({
              url: img.url || (img as any).data_url || '',
              label: img.filename || `Photo #${pos}`,
              index: seq++,
              groupName: `Image #${pos}`,
            });
          });
        } else {
          // 1. Reference Photo (1st Attached)
          const shouldAttachRef = useReferenceImage && boxConfig.useReferenceImage !== false;
          const refUrl = shouldAttachRef
            ? (activeReferenceImage?.url || referenceImage || boxConfig.referenceImage || (propertyContext?.images && propertyContext.images[0]?.url) || null)
            : null;

          if (refUrl) {
            allAttachedChatPhotos.push({
              url: refUrl,
              label: 'Ref Layout (#1)',
              index: seq++,
              groupName: 'Reference Image',
            });
          }

          // 2. Condo / Attached Group Photos (2nd Attached)
          const shouldAttachCondo = useCondoImages && boxConfig.useCondoImages !== false;
          if (shouldAttachCondo) {
            const resolved = resolveAttachedPhotosFromSteps(
              attachmentSteps,
              effectiveWorkflowImageSources,
              propertyContext?.images,
              availableEnhancedPhotos
            );
            if (resolved && resolved.length > 0) {
              resolved.forEach((p, idx) => {
                allAttachedChatPhotos.push({
                  url: p.url || p.data_url || '',
                  label: p.filename || `Condo Photo #${idx + 1}`,
                  index: seq++,
                  groupName: `Group Photo #${idx + 1}`,
                });
              });
            } else {
              const selectedCondoImgs = condoSlots.filter(Boolean);
              const targetCondoCount = typeof condoImagesCount === 'number' ? condoImagesCount : 3;
              const fallbackList = selectedCondoImgs.length > 0
                ? selectedCondoImgs.slice(0, targetCondoCount)
                : (propertyContext?.images || []).slice(0, targetCondoCount);

              fallbackList.forEach((img: any, i: number) => {
                allAttachedChatPhotos.push({
                  url: typeof img === 'string' ? img : img.url || img.data_url || '',
                  label: img.filename || `Photo #${i + 1}`,
                  index: seq++,
                  groupName: `Photo #${i + 1}`,
                });
              });
            }
          }
        }

        const runButtonContent = (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', width: '100%', minHeight: '34px' }}>
            {/* Preview Button */}
            <button
              type="button"
              title="Preview Attached Images & Prompt in Chat"
              onClick={() => {
                onCloseSettingsSidebox?.();
                setShowPromptViewSidebox(true);
              }}
              style={{
                height: '34px',
                width: '34px',
                minWidth: '34px',
                borderRadius: '7px',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: 'none',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              <FiEye size={15} />
            </button>

            {isAutomating || isRunningTwoStage ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                {/* Clean Running Status Pill */}
                <div
                  style={{
                    flex: 1,
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: isDark ? 'rgba(37, 99, 235, 0.12)' : 'rgba(37, 99, 235, 0.08)',
                    border: isDark ? '1px solid rgba(59, 130, 246, 0.35)' : '1px solid rgba(37, 99, 235, 0.25)',
                    color: isDark ? '#93C5FD' : '#1D4ED8',
                    fontSize: '0.78125rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '7px',
                    padding: '0 12px',
                    userSelect: 'none',
                    letterSpacing: '0.01em',
                  }}
                >
                  <FiLoader className="animate-spin" size={13} style={{ color: '#3B82F6' }} />
                  <span>Running...</span>
                </div>

                {/* Sleek Stop Button */}
                <button
                  type="button"
                  title="Stop active automation"
                  onClick={handleStopGroupAutomation}
                  style={{
                    height: '34px',
                    padding: '0 14px',
                    borderRadius: '7px',
                    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2',
                    border: isDark ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid #FECACA',
                    color: isDark ? '#F87171' : '#DC2626',
                    fontSize: '0.78125rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = isDark ? 'rgba(239, 68, 68, 0.22)' : '#FEE2E2';
                    e.currentTarget.style.borderColor = isDark ? 'rgba(239, 68, 68, 0.55)' : '#FCA5A5';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2';
                    e.currentTarget.style.borderColor = isDark ? 'rgba(239, 68, 68, 0.35)' : '#FECACA';
                  }}
                >
                  <FiSquare size={10} style={{ fill: 'currentColor' }} />
                  <span>Stop</span>
                </button>
              </div>
            ) : (
              /* Main Run Button */
              <button
                type="button"
                onClick={() => {
                  if (isHeroNode) {
                    handleRunTwoStageTest();
                  } else {
                    setSelectedGroupName(currentGroup.name || boxConfig.browserGroupName || 'Enhance IMG');
                    handleStartGroupAutomation();
                  }
                }}
                style={{
                  flex: 'none',
                  padding: '0 20px',
                  height: '34px',
                  borderRadius: '7px',
                  border: '1px solid transparent',
                  backgroundColor: isDark ? '#326EE6' : '#0F172A',
                  color: '#FFFFFF',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  boxShadow: 'none',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = isDark ? '#295EC9' : '#1E293B';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isDark ? '#326EE6' : '#0F172A';
                }}
              >
                <FiPlay size={12} style={{ fill: 'currentColor' }} />
                <span>Run</span>
              </button>
            )}
          </div>
        );

        if (targetFooterEl) {
          return createPortal(runButtonContent, targetFooterEl);
        }

        return (
          <div style={{ marginTop: 'auto', paddingTop: '0.5rem', width: '100%' }}>
            {runButtonContent}
          </div>
        );
      })()}

      {/* ── CHAT COMPOSER PREVIEW SIDEBOX (IMAGES & PROMPT PREVIEW) ── */}
      {showPromptViewSidebox && (() => {
        // Compute attached photos inside sidebox
        const attachedPhotosList: Array<{ url: string; label: string; index: number }> = [];
        let pSeq = 1;

        if (isEnhanceNode) {
          activeImages.forEach((img, i) => {
            const pos = typeof img.index === 'number' && img.index > 0 ? img.index : i + 1;
            attachedPhotosList.push({
              url: img.url || (img as any).data_url || '',
              label: img.filename || `Photo #${pos}`,
              index: pSeq++,
            });
          });
        } else {
          const shouldAttachRef = useReferenceImage && boxConfig.useReferenceImage !== false;
          const refUrl = shouldAttachRef
            ? (activeReferenceImage?.url || referenceImage || boxConfig.referenceImage || (propertyContext?.images && propertyContext.images[0]?.url) || null)
            : null;

          if (refUrl) {
            attachedPhotosList.push({
              url: refUrl,
              label: 'Ref Layout (#1)',
              index: pSeq++,
            });
          }

          const shouldAttachCondo = useCondoImages && boxConfig.useCondoImages !== false;
          if (shouldAttachCondo) {
            const resolved = resolveAttachedPhotosFromSteps(
              attachmentSteps,
              effectiveWorkflowImageSources,
              propertyContext?.images,
              availableEnhancedPhotos
            );
            if (resolved && resolved.length > 0) {
              resolved.forEach((p, idx) => {
                attachedPhotosList.push({
                  url: p.url || p.data_url || '',
                  label: p.filename || `Condo Photo #${idx + 1}`,
                  index: pSeq++,
                });
              });
            } else {
              const selectedCondoImgs = condoSlots.filter(Boolean);
              const targetCondoCount = typeof condoImagesCount === 'number' ? condoImagesCount : 3;
              const fallbackList = selectedCondoImgs.length > 0
                ? selectedCondoImgs.slice(0, targetCondoCount)
                : (propertyContext?.images || []).slice(0, targetCondoCount);

              fallbackList.forEach((img: any, i: number) => {
                attachedPhotosList.push({
                  url: typeof img === 'string' ? img : img.url || img.data_url || '',
                  label: img.filename || `Photo #${i + 1}`,
                  index: pSeq++,
                });
              });
            }
          }
        }

        return (
          <div
            style={{
              position: 'fixed',
              top: 0,
              bottom: 0,
              right: '380px', // sits smoothly right alongside the 380px main sidebar inspector
              width: '460px',
              maxWidth: 'calc(100vw - 420px)',
              backgroundColor: isDark ? 'var(--bg-main)' : '#FFFFFF',
              borderLeft: '1px solid var(--border-color)',
              borderRight: '1px solid var(--border-color)',
              boxShadow: isDark ? '-12px 0 35px rgba(0, 0, 0, 0.75)' : '-6px 0 24px rgba(0, 0, 0, 0.08)',
              zIndex: 169,
              display: 'flex',
              flexDirection: 'column',
              animation: 'sidebarSlideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Top Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.875rem 1.125rem',
                borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #E2E8F0',
                backgroundColor: isDark ? 'var(--bg-main)' : '#FFFFFF',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(59, 130, 246, 0.12)',
                    color: '#3B82F6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <FiEye size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                    Chat Composer Preview
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {(boxConfig.title && boxConfig.title !== 'Tab Group' ? boxConfig.title : boxConfig.browserGroupName) || 'Chat Model'} · {attachedPhotosList.length} Photos Attached
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowPromptViewSidebox(false)}
                title="Close Preview"
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#FFFFFF',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <FiX size={15} />
              </button>
            </div>

            {/* Main Scrollable Body */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '1rem 1.125rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
              }}
            >
              {/* 1. Attached Photos in Chat Sequence */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    <FiImage size={13} style={{ color: '#10B981' }} />
                    <span>Attached Images ({attachedPhotosList.length})</span>
                  </label>
                  <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                    Sequence in Chat Message
                  </span>
                </div>

                {attachedPhotosList.length > 0 ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      overflowX: 'auto',
                      padding: '4px 2px 8px 2px',
                    }}
                  >
                    {attachedPhotosList.map((photo) => (
                      <div
                        key={`${photo.index}-${photo.url}`}
                        style={{
                          width: '80px',
                          flexShrink: 0,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                        }}
                      >
                        <div
                          style={{
                            width: '80px',
                            height: '66px',
                            borderRadius: '6px',
                            border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #CBD5E1',
                            overflow: 'hidden',
                            position: 'relative',
                            backgroundColor: isDark ? '#25282B' : '#F1F5F9',
                          }}
                        >
                          {photo.url ? (
                            <img
                              src={photo.url}
                              alt={photo.label}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                              <FiImage size={16} />
                            </div>
                          )}
                          <span
                            style={{
                              position: 'absolute',
                              top: 3,
                              left: 3,
                              backgroundColor: 'rgba(0, 0, 0, 0.75)',
                              color: '#FFFFFF',
                              fontSize: '0.59375rem',
                              fontWeight: 700,
                              padding: '1px 5px',
                              borderRadius: '3px',
                              letterSpacing: '0.2px',
                            }}
                          >
                            #{photo.index}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: '0.625rem',
                            color: 'var(--text-muted)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            textAlign: 'center',
                          }}
                          title={photo.label}
                        >
                          {photo.label}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      padding: '12px',
                      borderRadius: '6px',
                      border: isDark ? '1px dashed rgba(255, 255, 255, 0.08)' : '1px dashed #CBD5E1',
                      fontSize: '0.6875rem',
                      color: 'var(--text-muted)',
                      fontStyle: 'italic',
                      textAlign: 'center',
                    }}
                  >
                    No images attached to this model box.
                  </div>
                )}
              </div>

              {/* 2. Chat Prompt Message Box */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    <FiFileText size={13} style={{ color: '#3B82F6' }} />
                    <span>Chat Prompt Message</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleCopyPrompt}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: isCopied ? '#10B981' : 'var(--accent-primary, #3B82F6)',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                    }}
                  >
                    {isCopied ? <FiCheck size={12} /> : <FiCopy size={12} />}
                    <span>{isCopied ? 'Copied' : 'Copy Prompt'}</span>
                  </button>
                </div>

                <div
                  style={{
                    borderRadius: '6px',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #E2E8F0',
                    backgroundColor: isDark ? '#181A1D' : '#F8FAFC',
                    padding: '10px 12px',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    fontSize: '0.75rem',
                    lineHeight: '1.65',
                    color: 'var(--text-primary)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: '400px',
                    overflowY: 'auto',
                  }}
                >
                  {resolvedPromptPreview || currentPromptText || 'No prompt content available.'}
                </div>
              </div>
            </div>

            {/* Footer with Close and Run Shortcut */}
            <div
              style={{
                padding: '0.75rem 1.125rem',
                borderTop: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #E2E8F0',
                backgroundColor: isDark ? 'var(--bg-main)' : '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
              }}
            >
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowPromptViewSidebox(false)}
                style={{ fontSize: '0.75rem', height: '34px', borderRadius: '6px' }}
              >
                Close
              </Button>

              <button
                type="button"
                disabled={isAutomating || isRunningTwoStage}
                onClick={() => {
                  setShowPromptViewSidebox(false);
                  if (isHeroNode) {
                    handleRunTwoStageTest();
                  } else {
                    setSelectedGroupName(currentGroup.name || boxConfig.browserGroupName || 'Enhance IMG');
                    handleStartGroupAutomation();
                  }
                }}
                style={{
                  height: '34px',
                  padding: '0 16px',
                  borderRadius: '6px',
                  border: '1px solid var(--accent-primary, #2563EB)',
                  backgroundColor: (isAutomating || isRunningTwoStage)
                    ? 'rgba(37, 99, 235, 0.6)'
                    : 'var(--accent-primary, #2563EB)',
                  color: '#FFFFFF',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: (isAutomating || isRunningTwoStage) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <FiPlay size={12} />
                <span>Run Now</span>
              </button>
            </div>
          </div>
        );
      })()}
      {/* Full-view Image Modal (Lightbox) */}
      {previewModalImage && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            padding: '20px',
            boxSizing: 'border-box',
          }}
          onClick={() => setPreviewModalImage(null)}
        >
          <div
            style={{
              maxWidth: '92vw',
              maxHeight: '92vh',
              backgroundColor: isDark ? '#25282B' : '#FFFFFF',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid #CBD5E1',
              borderRadius: '12px',
              boxShadow: '0 24px 48px rgba(0, 0, 0, 0.5), 0 8px 16px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxSizing: 'border-box',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 16px',
                borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #E2E8F0',
                backgroundColor: isDark ? '#181A1D' : '#F8FAFC',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    color: '#10B981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <FiCheckCircle size={14} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '0.8125rem',
                      fontWeight: 700,
                      color: isDark ? '#F3F4F6' : '#1E293B',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {previewModalImage.title || 'Full Resolution Image Preview'}
                  </div>
                  {previewModalImage.fileName && (
                    <div
                      style={{
                        fontSize: '0.625rem',
                        color: isDark ? '#8B949E' : '#64748B',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {previewModalImage.fileName}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                {previewModalImage.fileName && (
                  <button
                    type="button"
                    onClick={() => {
                      fetch(`http://127.0.0.1:9224/reveal-file?file=${encodeURIComponent(previewModalImage.fileName || '')}`).catch(() => { });
                    }}
                    style={{
                      height: '28px',
                      padding: '0 10px',
                      borderRadius: '6px',
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
                      border: '1px solid var(--border-color)',
                      color: isDark ? '#F3F4F6' : '#1E293B',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                    title="Reveal in Finder"
                  >
                    <FiFolder size={12} />
                    <span>Reveal in Finder</span>
                  </button>
                )}

                <a
                  href={previewModalImage.url}
                  download={previewModalImage.fileName || 'download.png'}
                  style={{
                    height: '28px',
                    padding: '0 10px',
                    borderRadius: '6px',
                    backgroundColor: '#2563EB',
                    border: '1px solid #1D4ED8',
                    color: '#FFFFFF',
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    textDecoration: 'none',
                    boxShadow: '0 1px 3px rgba(37, 99, 235, 0.3)',
                  }}
                  title="Download image file"
                >
                  <FiDownload size={12} />
                  <span>Download</span>
                </a>

                <button
                  type="button"
                  onClick={() => setPreviewModalImage(null)}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
                    border: 'none',
                    color: isDark ? '#9CA3AF' : '#6B7280',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#EF4444')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = isDark ? '#9CA3AF' : '#6B7280')}
                  title="Close modal (Esc)"
                >
                  <FiX size={16} />
                </button>
              </div>
            </div>

            {/* Modal Image Body */}
            <div
              style={{
                padding: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#0a0a0a',
                overflow: 'auto',
                maxHeight: 'calc(92vh - 120px)',
              }}
            >
              <img
                src={previewModalImage.url}
                alt={previewModalImage.title || 'Image Preview'}
                style={{
                  maxWidth: '100%',
                  maxHeight: 'calc(80vh - 60px)',
                  width: 'auto',
                  height: 'auto',
                  objectFit: 'contain',
                  borderRadius: '6px',
                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.7)',
                  display: 'block',
                }}
              />
            </div>

            {/* Modal Footer (File path) */}
            {previewModalImage.filePath && (
              <div
                style={{
                  padding: '8px 14px',
                  borderTop: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #E2E8F0',
                  backgroundColor: isDark ? '#181A1D' : '#F8FAFC',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  fontSize: '0.625rem',
                }}
              >
                <div
                  style={{
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    color: isDark ? '#93C5FD' : '#1D4ED8',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}
                  title={previewModalImage.filePath}
                >
                  {previewModalImage.filePath}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(previewModalImage.filePath || '');
                    setCopiedHeroPath(true);
                    setTimeout(() => setCopiedHeroPath(false), 2000);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: copiedHeroPath ? '#10B981' : (isDark ? '#9CA3AF' : '#6B7280'),
                    fontSize: '0.625rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    flexShrink: 0,
                  }}
                >
                  {copiedHeroPath ? <FiCheck size={11} /> : <FiCopy size={11} />}
                  <span>{copiedHeroPath ? 'Copied' : 'Copy Path'}</span>
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* ── COMPACT IMAGE ORDER MODAL (Drag & Drop without renaming files) ── */}
      {showOrderModal && typeof document !== 'undefined' && createPortal(
        <div
          onClick={() => setShowOrderModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            backgroundColor: 'rgba(0, 0, 0, 0.72)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '520px',
              maxHeight: '85vh',
              backgroundColor: isDark ? '#181A1D' : '#FFFFFF',
              borderRadius: '12px',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #E2E8F0',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.65)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid #E2E8F0',
              }}
            >
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: isDark ? '#F0F6FC' : '#0F172A' }}>
                  Adjust Enhanced Images Order ({orderDraft.length})
                </div>
                <div style={{ fontSize: '0.68rem', color: isDark ? '#8B949E' : '#64748B' }}>
                  Drag photos to reorder. Filenames stay unchanged; updates all connected nodes.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowOrderModal(false)}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: isDark ? '#8B949E' : '#64748B',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FiX size={16} />
              </button>
            </div>

            {/* Compact 4-col Draggable Grid */}
            <div
              style={{
                padding: '14px',
                overflowY: 'auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '8px',
              }}
            >
              {orderDraft.map((img, idx) => {
                const imgSrc = img.url
                  ? (img.url.includes('?') ? `${img.url}&_cb=${cacheBustTimestamp}` : `${img.url}?_cb=${cacheBustTimestamp}`)
                  : '';
                const moveDraft = (from: number, to: number) => {
                  if (to < 0 || to >= orderDraft.length || from === to) return;
                  const next = [...orderDraft];
                  const [moved] = next.splice(from, 1);
                  next.splice(to, 0, moved);
                  setOrderDraft(next);
                };
                return (
                  <div
                    key={img.filename || img.position || idx}
                    draggable
                    onDragStart={() => setDragOrderIdx(idx)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragOrderIdx !== null && dragOrderIdx !== idx) {
                        moveDraft(dragOrderIdx, idx);
                      }
                      setDragOrderIdx(null);
                    }}
                    onDragEnd={() => setDragOrderIdx(null)}
                    style={{
                      position: 'relative',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      border: dragOrderIdx === idx
                        ? '2px solid #3B82F6'
                        : (isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #CBD5E1'),
                      backgroundColor: isDark ? '#25282B' : '#F8FAFC',
                      cursor: 'grab',
                      userSelect: 'none',
                      opacity: dragOrderIdx === idx ? 0.6 : 1,
                    }}
                  >
                    <div style={{ width: '100%', height: '86px', position: 'relative', backgroundColor: '#181A1D' }}>
                      <img
                        src={imgSrc}
                        alt={img.filename}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }}
                      />
                      {/* New slot badge */}
                      <span
                        style={{
                          position: 'absolute',
                          top: '4px',
                          left: '4px',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          backgroundColor: '#2563EB',
                          color: '#FFFFFF',
                          fontSize: '0.6rem',
                          fontWeight: 700,
                        }}
                      >
                        Pos {idx + 1}
                      </span>
                      {/* Original file number badge */}
                      <span
                        style={{
                          position: 'absolute',
                          top: '4px',
                          right: '4px',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(0,0,0,0.72)',
                          color: '#E2E8F0',
                          fontSize: '0.58rem',
                          fontWeight: 600,
                        }}
                      >
                        #{img.position || idx + 1}
                      </span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '3px 5px',
                        gap: '2px',
                      }}
                    >
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveDraft(idx, idx - 1)}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: idx === 0 ? 'var(--text-muted)' : (isDark ? '#E2E8F0' : '#334155'),
                          opacity: idx === 0 ? 0.3 : 0.9,
                          cursor: idx === 0 ? 'default' : 'pointer',
                          fontSize: '0.68rem',
                          padding: '0 3px',
                        }}
                      >
                        ←
                      </button>
                      <span
                        style={{
                          fontSize: '0.56rem',
                          color: isDark ? '#8B949E' : '#64748B',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {img.filename}
                      </span>
                      <button
                        type="button"
                        disabled={idx === orderDraft.length - 1}
                        onClick={() => moveDraft(idx, idx + 1)}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: idx === orderDraft.length - 1 ? 'var(--text-muted)' : (isDark ? '#E2E8F0' : '#334155'),
                          opacity: idx === orderDraft.length - 1 ? 0.3 : 0.9,
                          cursor: idx === orderDraft.length - 1 ? 'default' : 'pointer',
                          fontSize: '0.68rem',
                          padding: '0 3px',
                        }}
                      >
                        →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 16px',
                borderTop: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid #E2E8F0',
                gap: '8px',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  const resetList = [...orderDraft].sort((a, b) => (a.position || 0) - (b.position || 0));
                  setOrderDraft(resetList);
                }}
                style={{
                  height: '32px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #CBD5E1',
                  backgroundColor: 'transparent',
                  color: isDark ? '#8B949E' : '#64748B',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Reset Original
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowOrderModal(false)}
                  style={{
                    height: '32px',
                    padding: '0 12px',
                    borderRadius: '6px',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #CBD5E1',
                    backgroundColor: 'transparent',
                    color: isDark ? '#E2E8F0' : '#334155',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const nextOrder = orderDraft.map((img) => img.filename || String(img.position || ''));
                    updateMultiConfig({ enhancedImagesOrder: nextOrder });
                    lastEnhancedSigRef.current = orderDraft.map((img) => `${img.position}:${img.backend_url || img.url}:${(img as any).size_bytes || (img as any).size || ''}`).join('|');
                    setEnhancedImages(orderDraft);
                    if (onEnhancedPhotosUpdate) {
                      onEnhancedPhotosUpdate(buildEnhancedPhotoMap(orderDraft, true));
                    }
                    setShowOrderModal(false);
                  }}
                  style={{
                    height: '32px',
                    padding: '0 14px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#2563EB',
                    color: '#FFFFFF',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <FiCheck size={13} />
                  <span>Done &amp; Apply Order</span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
