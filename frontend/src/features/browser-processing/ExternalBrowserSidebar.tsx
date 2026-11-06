import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  FiLoader,
  FiStar,
  FiZap,
  FiSettings,
  FiFileText,
  FiEdit3,
  FiSearch,
  FiSquare,
  FiMaximize2,
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
  onOpenSettingsSidebox,
  onCloseSettingsSidebox,
  isSettingsSideboxOpen,
  rawPostContent,
  onRunCondoNameStep,
  onEnhancedPhotosUpdate,
}) => {
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

  // 4b. Authoritative Hero vs Enhance Node Classification
  const nodeTitle = (boxConfig.title || boxConfig.browserGroupName || '').toLowerCase();
  const isEnhanceNode = Boolean(
    nodeTitle.includes('enhance') ||
    (!nodeTitle.includes('hero') && !nodeTitle.includes('fb') && (boxConfig.tabGroupMode === 'enhance' || boxConfig.processKind === 'enhance_images'))
  );

  const isHeroNode = !isEnhanceNode && Boolean(
    nodeTitle.includes('hero') ||
    nodeTitle.includes('fb') ||
    boxConfig.tabGroupMode === 'generate' ||
    boxConfig.processKind === 'generate_image'
  );

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
  const [selectedProfileId, setSelectedProfileId] = useState<number>(() => boxConfig.browserProfileId || 11);
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
    const matching = propertyContext?.upstreamPrompts?.find((p) =>
      p.title.toLowerCase().includes('hero') || p.title.toLowerCase().includes('fb')
    );
    if (matching) return matching.id;
    return propertyContext?.upstreamPrompts?.[0]?.id || '';
  });

  const [tabGroupMode, setTabGroupMode] = useState<'enhance' | 'generate'>(() => {
    if (isHeroNode) return 'generate';
    if (isEnhanceNode) return 'enhance';
    if (boxConfig.tabGroupMode) return boxConfig.tabGroupMode;
    return 'enhance';
  });

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

  const [latestHeroImage, setLatestHeroImage] = useState<{
    url: string;
    fileName?: string;
    condoName?: string;
    createdAt?: string;
  } | null>(() => {
    try {
      const saved = localStorage.getItem('bolthaven_last_hero_image');
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      const activeCondo = (aiExtractedCondoName || propertyContext?.title || boxConfig.browserCondoName || '').trim();
      if (!activeCondo || activeCondo === 'Featured Property Listing' || activeCondo === 'Facebook Property Post') {
        return null;
      }
      if (parsed?.condoName && activeCondo.toLowerCase().includes(parsed.condoName.toLowerCase())) {
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
        localStorage.setItem('bolthaven_last_hero_image', JSON.stringify(img));
      } else {
        localStorage.removeItem('bolthaven_last_hero_image');
      }
    } catch (e) {}
  };

  // Auto-fetch latest downloaded Hero image on mount or when sidebar is opened
  useEffect(() => {
    if (!isHeroNode) return;
    const fetchLatestStatus = async () => {
      try {
        const queryCondo = (condoName || condoSearchQuery || '').trim();
        if (!queryCondo || queryCondo === 'Featured Property Listing' || queryCondo === 'Facebook Property Post') {
          return;
        }
        const resp = await fetch(`http://127.0.0.1:9224/two-stage-status?condo=${encodeURIComponent(queryCondo)}`);
        if (resp.ok) {
          const data = await resp.json();
          if (data?.state) {
            setTwoStageStatus(data.state);
            if (data.state.downloaded_image_url || data.state.downloaded_file) {
              const file = data.state.downloaded_file;
              const stateCondo = data.state.condo_name || '';
              if (
                !queryCondo ||
                stateCondo.toLowerCase().includes(queryCondo.toLowerCase()) ||
                queryCondo.toLowerCase().includes(stateCondo.toLowerCase()) ||
                file.toLowerCase().includes(queryCondo.toLowerCase().replace(/[^a-z0-9]/g, ''))
              ) {
                const imgUrl = data.state.downloaded_image_url || `http://127.0.0.1:9224/hero-downloaded-image?file=${encodeURIComponent(file)}`;
                updateLatestHeroImage({
                  url: imgUrl,
                  fileName: file,
                  condoName: stateCondo || queryCondo,
                  createdAt: data.state.updated_at,
                });
              }
            }
          }
        }
      } catch (e) {}
    };
    fetchLatestStatus();
  }, [isHeroNode, condoName, condoSearchQuery]);

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
        setFinderFeedback('Opened in Finder');
        setTimeout(() => setFinderFeedback(null), 2500);
      }
    } catch (err) {
      console.warn('Failed to open folder in Finder:', err);
    } finally {
      setIsOpeningFinder(false);
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
    }
  }, [aiExtractedCondoName, propertyContext?.title, boxConfig.targetFolder]);

  // Synchronize state when boxConfig is updated from FBHeroSettingsSidebox
  useEffect(() => {
    if (boxConfig.referenceImage) {
      if (boxConfig.referenceImage !== referenceImage) {
        setReferenceImage(boxConfig.referenceImage);
        setReferenceImageMode('custom_upload');
      }
    } else if (boxConfig.referenceImage === '' && isReferenceImageExplicitlyDeleted()) {
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
    }
  }, [boxConfig.selectedUpstreamAiId]);

  useEffect(() => {
    if (boxConfig.browserCustomPrompt !== undefined && boxConfig.browserCustomPrompt !== customPromptText) {
      setCustomPromptText(boxConfig.browserCustomPrompt);
    }
  }, [boxConfig.browserCustomPrompt]);

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

      const selectedCondoImgs = condoSlots.filter(Boolean);
      let condoImagesToUse: any[] = [];
      if (selectedCondoImgs.length > 0) {
        condoImagesToUse = selectedCondoImgs;
      } else if (matchedCondoInfo?.images && matchedCondoInfo.images.length > 0) {
        condoImagesToUse = matchedCondoInfo.images;
      } else if (Array.isArray(boxConfig.condoImages) && boxConfig.condoImages.length > 0) {
        condoImagesToUse = boxConfig.condoImages;
      } else if (propertyContext?.images && propertyContext.images.length > 0) {
        condoImagesToUse = propertyContext.images.slice(0, 3).map((img, i) => ({
          index: i + 1,
          filename: img.filename || `Condo Photo #${i + 1}`,
          url: img.url,
          data_url: img.url,
        }));
      }

      const promptToUse = (resolvedPromptPreview || currentPromptText || 'Create facebook advertisement from the attached reference and building photos').trim();
      const refImgToUse = activeReferenceImage?.url || referenceImage || boxConfig.referenceImage || (propertyContext?.images && propertyContext.images[0]?.url) || null;
      const effectiveHeroGroupName = currentGroup?.name || targetGroupName || 'FB Hero';
      const isDirectStaging = boxConfig.stagingMode !== 'two_stage';

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
      }).catch(() => {});

      const resp = await fetch('http://127.0.0.1:9224/start-two-stage-staging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_key: profKey,
          group_name: effectiveHeroGroupName,
          condo_name: matchedCondoInfo?.matched_folder || aiExtractedCondoName || condoSearchQuery || condoName,
          matched_folder: matchedCondoInfo?.matched_folder || '',
          condo_images: condoImagesToUse.slice(0, 3),
          initial_prompt: promptToUse,
          reference_image: refImgToUse,
          reference_image_index: activeReferenceImage?.index || 1,
          enable_prompt_enhance: enablePromptEnhance,
          target_folder: boxConfig.targetFolder || localStorage.getItem('bolthaven_condo_target_folder') || '',
          use_condo_images: boxConfig.useCondoImages !== false,
          use_reference_image: boxConfig.useReferenceImage !== false,
          skip_tab1: isDirectStaging,
          tab_mode: boxConfig.workerTabMode || 'existing_tabs',
          worker_count: isDirectStaging ? 1 : 2,
          reuse_session_tabs: boxConfig.reuseSessionTabs !== false,
        }),
      });
      const data = await resp.json();
      if (isSidebarStoppedRef.current) return;
      if (data.status === 'success') {
        setTwoStageMessage(
          isDirectStaging
            ? `🚀 Direct Mode (1 Tab): Opening connected browser & attaching Reference + 3 Condo Photos for "${data.matched_folder || condoName}"...`
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
            const stResp = await fetch('http://127.0.0.1:9224/two-stage-status');
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
                const imgUrl = stData.state.downloaded_image_url || `http://127.0.0.1:9224/hero-downloaded-image?file=${encodeURIComponent(file)}`;
                updateLatestHeroImage({
                  url: imgUrl,
                  fileName: file,
                  condoName: stData.state.condo_name || condoName,
                  createdAt: stData.state.updated_at,
                });
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
                    ? '⚡ Direct Mode (1 Tab): Prompt ready, attaching Reference Image (1st) + 3 Condo Photos...'
                    : '✓ Tab 1: Extracted prompt! Focusing Tab 2...'
                );
              } else if (stData.state.step === 'stage2_running') {
                setTwoStageMessage('🖼️ Attaching Reference Image (1st), Condo Photos 1, 2, 3 (next), and pasting prompt...');
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
                  const imgUrl = stData.state.downloaded_image_url || `http://127.0.0.1:9224/hero-downloaded-image?file=${encodeURIComponent(file)}`;
                  updateLatestHeroImage({
                    url: imgUrl,
                    fileName: file,
                    condoName: stData.state.condo_name || condoName,
                    createdAt: stData.state.updated_at,
                  });
                }
              } else if (stData.state.step === 'error') {
                clearInterval(interval);
                twoStageIntervalRef.current = null;
                setIsRunningTwoStage(false);
                setTwoStageMessage(`⚠️ Error: ${stData.state.error}`);
              }
            }
          } catch (e) {}
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

  // Sync selectedProfileId when boxConfig profile changes
  useEffect(() => {
    if (boxConfig.browserProfileId) {
      setSelectedProfileId(boxConfig.browserProfileId);
    } else if (boxConfig.browserProfileKey && profiles.length > 0) {
      const match = profiles.find((p) => p.profile_key === boxConfig.browserProfileKey);
      if (match) setSelectedProfileId(match.id);
    } else if (boxConfig.browserProfileName && profiles.length > 0) {
      const match = profiles.find(
        (p) => p.display_name === boxConfig.browserProfileName || p.display_name.includes(boxConfig.browserProfileName)
      );
      if (match) setSelectedProfileId(match.id);
    }
  }, [boxConfig.browserProfileId, boxConfig.browserProfileKey, boxConfig.browserProfileName, profiles]);

  // When profile changes, automatically reload and bind tab groups & tabs
  useEffect(() => {
    if (selectedProfileId) {
      const currentProf = profiles.find((p) => p.id === selectedProfileId);
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

  // Load live image queue for current property only (never show historical runs)
  const loadQueue = () => {
    const currentPropId = propertyContext?.id;
    if (currentPropId) {
      setIsLoadingQueue(true);
      fetchImageQueue(currentPropId).then((jobs) => {
        const matching = (jobs || []).filter((j) => j.property_id === currentPropId);
        setQueueJobs(matching);
        setIsLoadingQueue(false);
      });
    } else {
      setQueueJobs([]);
      setIsLoadingQueue(false);
    }
  };

  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 4000);
    return () => clearInterval(interval);
  }, [propertyContext?.id]);

  // Poll automation progress and downloaded enhanced images
  useEffect(() => {
    let interval: any = null;
    const checkProgressAndImages = async () => {
      try {
        const status = await getAutomationStatus();
        if (status) {
          setAutomationStatus(status);
          if (!status.is_running) {
            setIsAutomating(false);
            if (status.completed !== undefined && status.completed > 0) {
              setAutomationMessage(`✓ All tabs finished! ${status.completed} images enhanced.`);
            }
          }
        }
      } catch (e) {}

      if (receivedImages.length === 0) {
        setEnhancedImages([]);
      } else {
        try {
          const enhanced = await fetchEnhancedDownloadedImages(propertyContext?.id, propertyContext?.listingCode);
          if (enhanced && enhanced.length > 0) {
            // Only accept images if their position matches the active received images in this session
            const valid = enhanced.filter((img) => (img.position || 1) <= receivedImages.length);
            if (valid.length > 0) {
              setEnhancedImages(valid);
              if (onEnhancedPhotosUpdate) {
                const map: Record<number, string> = {};
                valid.forEach((img) => {
                  const pos0 = (img.position || 1) - 1; // 0-based index key
                  map[pos0] = img.backend_url || img.url;
                });
                onEnhancedPhotosUpdate(map);
              }
            }
          }
        } catch (e) {}
      }

      loadQueue();
    };

    checkProgressAndImages();
    interval = setInterval(checkProgressAndImages, isAutomating ? 1500 : 3500);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isAutomating, propertyContext?.id, receivedImages.length]);

  // Notify parent of running state changes (never report running if this step is disabled)
  useEffect(() => {
    onRunningChange?.(boxConfig.enabled !== false && (isAutomating || isRunningTwoStage));
  }, [boxConfig.enabled, isAutomating, isRunningTwoStage, onRunningChange]);

  // Handler: Start Multi-Tab Automated Queue across all tabs in selected group
  const handleStartGroupAutomation = async () => {
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
    const effectiveWorkerCount = isHeroNode
      ? (boxConfig.skipTab1 || boxConfig.stagingMode === 'direct_tab2' || boxConfig.workerTabCount === 1 ? 1 : 2)
      : (boxConfig.workerTabCount || (groupTabs.length || 4));
    const isNewTabsMode = (boxConfig as any).workerTabMode === 'new_tabs';
    let targetUrls = isNewTabsMode
      ? Array(effectiveWorkerCount).fill('https://chatgpt.com/')
      : groupTabs.map((t) => t.url).filter((u) => u && !u.includes('6ad49918') && !u.includes('6ad49924'));
    if (targetUrls.length === 0 || isNewTabsMode) {
      targetUrls = Array(effectiveWorkerCount).fill('https://chatgpt.com/');
    } else if (targetUrls.length > effectiveWorkerCount) {
      targetUrls = targetUrls.slice(0, effectiveWorkerCount);
    }

    const hasImages = activeImages.length > 0 || queueJobs.length > 0;
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
    }).catch(() => {});

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

    const imgs = activeImages.map((img, i) => ({
      index: i + 1,
      source_url: img.url,
      stored_url: img.url,
      width: outputWidth,
      height: outputHeight,
      resolved_prompt: promptToUse,
    }));

    // Create or refresh batch queue with the active images if prompt enhancement is active
    let createdBatchJobs: ImageProcessingJob[] = [];
    if (activeImages.length > 0 && enablePromptEnhance) {
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
    setAutomationMessage(`Auto-opened Chrome [${profKey}] & Tab Group [${effectiveGroupName}]. Processing across ${effectiveWorkerCount} tabs...`);

    const res = await startAutomation({
      property_id: propId,
      listing_code: propertyContext?.listingCode || '',
      profile_key: profKey,
      group_name: effectiveGroupName,
      group_tab_urls: targetUrls,
      tab_ids: finalTabIds,
      tab_mode: isNewTabsMode ? 'new_tabs' : ((boxConfig as any).workerTabMode || 'existing_tabs'),
      worker_count: effectiveWorkerCount,
      reuse_session_tabs: (boxConfig as any).reuseSessionTabs ?? true,
      jobs: (createdBatchJobs.length > 0 ? createdBatchJobs : queueJobs).map((j) => ({
        ...j,
        listing_code: propertyContext?.listingCode || (j as any).listing_code || '',
      })),
    });
    if (isSidebarStoppedRef.current) return;

    if (!res.success) {
      setIsAutomating(false);
      setAutomationMessage(`Error: ${res.message}`);
      setTimeout(() => setAutomationMessage(null), 4500);
    } else {
      setAutomationMessage(`⚡ Processing images across ${finalTabIds.length} tabs...`);
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
    setTwoStageMessage('Automation stopped.');
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
      const list = receivedImages.filter((img, i) =>
        selectedImageIndices.includes(typeof img.index === 'number' && img.index > 0 ? img.index : i + 1)
      );
      return list.length > 0 ? list : receivedImages;
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

  // Target group for this node (Strict Hero vs Enhance Isolation)
  const currentGroup: BrowserGroupItem = useMemo(() => {
    const target = targetGroupName.toLowerCase();
    const matched = isHeroNode
      ? tabGroups.find((g) => {
          const gn = g.name.toLowerCase();
          return (gn.includes('hero') || gn.includes('fb')) && !gn.includes('enhance');
        })
      : isEnhanceNode
      ? tabGroups.find((g) => {
          const gn = g.name.toLowerCase();
          return gn.includes('enhance') && !gn.includes('hero') && !gn.includes('fb');
        })
      : (
          tabGroups.find((g) => g.name.toLowerCase() === target) ||
          tabGroups.find((g) => target && (target.includes(g.name.toLowerCase()) || g.name.toLowerCase().includes(target)))
        );

    if (matched) return matched;

    // Node's own saved or default tabs (never grab Enhance IMG when inspecting FB Hero or another node!)
    const savedLive: BrowserTabItem[] = (boxConfig._liveGroupTabs || []).filter((t: any) => Boolean(t && (t.title || t.url)));
    const savedUrls: string[] = (boxConfig.browserGroupTabUrls || []).filter(Boolean);
    const count = savedLive.length || savedUrls.length || (isHeroNode ? 2 : 4);

    const defaultTabs: BrowserTabItem[] = isHeroNode
      ? [
          {
            id: 'tab-hero-1',
            title: 'ChatGPT — Staging Prompt Gen (Worker #1)',
            url: savedUrls[0] || 'https://chatgpt.com',
            hostname: 'chatgpt.com',
            is_chatgpt: true,
            is_connected: true,
            is_selected: true,
          },
          {
            id: 'tab-hero-2',
            title: 'ChatGPT — 1080x1350 Staging Ad (Worker #2)',
            url: savedUrls[1] || 'https://chatgpt.com',
            hostname: 'chatgpt.com',
            is_chatgpt: true,
            is_connected: true,
            is_selected: false,
          },
        ]
      : Array.from({ length: count }).map((_, i: number): BrowserTabItem => ({
          id: `tab-${i + 1}`,
          title: `${targetGroupName} Worker #${i + 1}`,
          url: savedUrls[i] || 'https://chatgpt.com',
          hostname: 'chatgpt.com',
          is_chatgpt: true,
          is_connected: true,
          is_selected: i === 0,
        }));

    return {
      id: `default-${target.replace(/[^a-z0-9]/g, '-')}`,
      name: boxConfig.title || boxConfig.browserGroupName || targetGroupName,
      color: isHeroNode ? '#8B5CF6' : '#3B82F6',
      is_active: true,
      tabs_count: count,
      tabs: savedLive.length > 0
        ? savedLive
        : (savedUrls.length > 0
            ? savedUrls.map((u: string, i: number): BrowserTabItem => ({
                id: `tab-${i + 1}`,
                title: isHeroNode
                  ? (i === 0 ? 'ChatGPT — Staging Prompt Gen (Worker #1)' : 'ChatGPT — 1080x1350 Staging Ad (Worker #2)')
                  : `${targetGroupName} Worker #${i + 1}`,
                url: u,
                hostname: 'chatgpt.com',
                is_chatgpt: true,
                is_connected: true,
                is_selected: i === 0,
              }))
            : defaultTabs),
    };
  }, [tabGroups, targetGroupName, boxConfig.browserGroupId, boxConfig._liveGroupTabs, boxConfig.browserGroupTabUrls, boxConfig.title, boxConfig.browserGroupName, isHeroNode]);

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
              backgroundColor: 'rgba(236, 72, 153, 0.12)',
              color: '#EC4899',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <FiImage size={14} />
          </div>
          <div>
            <div style={{ fontSize: '0.78125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Reference Image
            </div>
            <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
              Layout example pasted into Tab 2
            </div>
          </div>
        </div>

        <span
          style={{
            fontSize: '0.5625rem',
            fontWeight: 600,
            padding: '2px 7px',
            borderRadius: '10px',
            backgroundColor: referenceImage ? 'rgba(16, 185, 129, 0.12)' : (isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9'),
            color: referenceImage ? '#10B981' : 'var(--text-muted)',
            border: '1px solid var(--border-color)',
          }}
        >
          {referenceImage ? 'Attached' : 'Optional'}
        </span>
      </div>

      {referenceImage ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.5rem 0.65rem',
            borderRadius: '8px',
            backgroundColor: isDark ? 'rgba(0, 0, 0, 0.25)' : '#F8FAFC',
            border: '1px solid rgba(236, 72, 153, 0.25)',
          }}
        >
          <img
            src={referenceImage}
            alt="Reference"
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '6px',
              objectFit: 'cover',
              border: '1px solid var(--border-color)',
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Active Reference Photo
            </div>
            <div style={{ fontSize: '0.5625rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Ready to paste in chat
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
              <label
                style={{
                  fontSize: '0.5625rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
                }}
              >
                Change
                <input type="file" accept="image/*" onChange={handleReferenceImageFile} style={{ display: 'none' }} />
              </label>
              <button
                type="button"
                onClick={handleRemoveReferenceImage}
                style={{
                  border: 'none',
                  background: 'none',
                  color: '#EF4444',
                  fontSize: '0.5625rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '2px 4px',
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.7rem 0.85rem',
            borderRadius: '8px',
            backgroundColor: isDark ? 'rgba(236, 72, 153, 0.03)' : '#FDF2F8',
            border: '1px dashed rgba(236, 72, 153, 0.35)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '7px',
                backgroundColor: 'rgba(236, 72, 153, 0.12)',
                color: '#EC4899',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <FiUploadCloud size={16} />
            </div>
            <div>
              <div style={{ fontSize: '0.71875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Add Reference Photo
              </div>
              <div style={{ fontSize: '0.5625rem', color: 'var(--text-muted)' }}>
                Example layout or composition
              </div>
            </div>
          </div>
          <span
            style={{
              fontSize: '0.625rem',
              fontWeight: 600,
              padding: '4px 9px',
              borderRadius: '6px',
              backgroundColor: 'rgba(236, 72, 153, 0.15)',
              color: '#EC4899',
              border: '1px solid rgba(236, 72, 153, 0.3)',
              flexShrink: 0,
            }}
          >
            Browse...
          </span>
          <input type="file" accept="image/*" onChange={handleReferenceImageFile} style={{ display: 'none' }} />
        </label>
      )}
    </div>
  );

  const renderCondoPhotosCard = () => (
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
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              color: '#10B981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <FiFolder size={14} />
          </div>
          <div>
            <div style={{ fontSize: '0.78125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Condo Photos (1, 2, 3)
            </div>
            <div
              style={{
                fontSize: '0.625rem',
                color: matchedCondoInfo?.matched_folder ? '#10B981' : 'var(--text-muted)',
                fontWeight: matchedCondoInfo?.matched_folder ? 600 : 400,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '175px',
              }}
              title={
                matchedCondoInfo?.matched_folder ||
                boxConfig.targetFolder ||
                localStorage.getItem('bolthaven_condo_target_folder') ||
                '~/Desktop/Condo Building'
              }
            >
              {matchedCondoInfo?.matched_folder ? `✓ ${matchedCondoInfo.matched_folder}` : 'Target: Condo Building'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <span
            style={{
              fontSize: '0.5625rem',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: '10px',
              backgroundColor:
                selectedCondoCount === 3
                  ? 'rgba(16, 185, 129, 0.15)'
                  : selectedCondoCount > 0
                  ? 'rgba(245, 158, 11, 0.15)'
                  : 'rgba(239, 68, 68, 0.12)',
              color:
                selectedCondoCount === 3
                  ? '#10B981'
                  : selectedCondoCount > 0
                  ? '#F59E0B'
                  : '#EF4444',
              border:
                selectedCondoCount === 3
                  ? '1px solid rgba(16, 185, 129, 0.3)'
                  : selectedCondoCount > 0
                  ? '1px solid rgba(245, 158, 11, 0.3)'
                  : '1px solid rgba(239, 68, 68, 0.25)',
              whiteSpace: 'nowrap',
            }}
          >
            {selectedCondoCount === 3 ? '3/3 Ready' : `${selectedCondoCount}/3 Selected`}
          </span>

          {/* Change / Select Photos Button */}
          <button
            type="button"
            onClick={() => {
              setShowFolderPicker((prev) => !prev);
              setActiveCondoSlot(null);
            }}
            title="Select & change condo photos"
            style={{
              padding: '3px 8px',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              backgroundColor: showFolderPicker
                ? isDark
                  ? 'rgba(255,255,255,0.12)'
                  : '#E2E8F0'
                : isDark
                ? 'rgba(255,255,255,0.06)'
                : '#F1F5F9',
              color: 'var(--text-primary)',
              fontSize: '0.625rem',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.15s ease',
            }}
          >
            <FiFolder size={11} style={{ opacity: 0.7 }} />
            <span>Change</span>
          </button>
        </div>
      </div>

      {/* Condo Photo Selector Drawer (Strictly 3 photos, select / remove / change) */}
      {showFolderPicker && (
        <div
          style={{
            padding: '10px',
            borderRadius: '8px',
            backgroundColor: isDark ? 'rgba(0, 0, 0, 0.4)' : '#F8FAFC',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            marginBottom: '4px',
          }}
        >
          {/* Drawer Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
              <span
                style={{
                  fontSize: '0.71875rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {matchedCondoInfo?.matched_folder || 'Condo'} Photos
              </span>
              <span style={{ fontSize: '0.59375rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                ({(matchedCondoInfo?.available_images || matchedCondoInfo?.images || []).length} available)
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              <span
                style={{
                  fontSize: '0.5625rem',
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: '10px',
                  backgroundColor:
                    selectedCondoCount === 3 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                  color: selectedCondoCount === 3 ? '#10B981' : '#F59E0B',
                  border:
                    selectedCondoCount === 3
                      ? '1px solid rgba(16, 185, 129, 0.3)'
                      : '1px solid rgba(245, 158, 11, 0.3)',
                }}
              >
                {selectedCondoCount}/3 Selected
              </span>

              <button
                type="button"
                onClick={() => {
                  setShowFolderPicker(false);
                  setActiveCondoSlot(null);
                }}
                title="Close photo drawer"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <FiX size={13} />
              </button>
            </div>
          </div>

          {/* Hint if not full 3 */}
          {selectedCondoCount < 3 ? (
            <div style={{ fontSize: '0.625rem', color: '#F59E0B', fontWeight: 500, lineHeight: 1.3 }}>
              Select {3 - selectedCondoCount} more photo{3 - selectedCondoCount > 1 ? 's' : ''} to complete the 3 required photos (Min: 3, Max: 3).
            </div>
          ) : (
            <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
              Click any selected photo to remove, or click an unselected photo to swap it into a slot.
            </div>
          )}

          {/* Photo Grid from this Condo Folder */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gridAutoRows: '64px',
              gap: '6px',
              maxHeight: '210px',
              overflowY: 'auto',
              padding: '2px',
            }}
          >
            {((matchedCondoInfo?.available_images && matchedCondoInfo.available_images.length > 0)
              ? matchedCondoInfo.available_images
              : (matchedCondoInfo?.images || [])
            ).map((photo: any, pIdx: number) => {
              // Find which slot (0, 1, 2) this photo is assigned to, if any
              const assignedSlot = condoSlots.findIndex(
                (s) =>
                  s &&
                  (s.full_path === photo.full_path ||
                    s.filename === photo.filename ||
                    (s.data_url && photo.data_url && s.data_url === photo.data_url))
              );
              const isSelected = assignedSlot !== -1;

              return (
                <div
                  key={photo.id || pIdx}
                  onClick={() => {
                    if (isSelected) {
                      // Clicking an already selected photo removes it from its slot
                      handleRemoveCondoSlot(assignedSlot);
                    } else {
                      // Assign to target or open slot
                      handleAssignCondoSlot(photo, activeCondoSlot !== null ? activeCondoSlot : undefined);
                      if (activeCondoSlot !== null) setActiveCondoSlot(null);
                    }
                  }}
                  title={
                    isSelected
                      ? `Selected as Slot #${assignedSlot + 1} — Click to remove`
                      : `${photo.filename} — Click to select`
                  }
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: '64px',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    border: isSelected
                      ? '2px solid var(--accent-primary, #2563EB)'
                      : '1px solid var(--border-color)',
                    backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : '#E2E8F0',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    opacity: isSelected ? 1 : 0.7,
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.opacity = '1';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.opacity = '0.7';
                  }}
                >
                  <img
                    src={photo.data_url}
                    alt={photo.filename}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    loading="lazy"
                  />

                  {/* Slot Number Badge */}
                  {isSelected && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '3px',
                        left: '3px',
                        backgroundColor: 'var(--accent-primary, #2563EB)',
                        color: '#FFFFFF',
                        fontSize: '0.5625rem',
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: '4px',
                        zIndex: 2,
                      }}
                    >
                      #{assignedSlot + 1}
                    </span>
                  )}

                  {/* Remove '✕' on selected photo */}
                  {isSelected && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '3px',
                        right: '3px',
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(0, 0, 0, 0.65)',
                        backdropFilter: 'blur(3px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#FFFFFF',
                        zIndex: 2,
                      }}
                    >
                      <FiX size={10} />
                    </span>
                  )}
                </div>
              );
            })}

            {/* Custom File Upload Option */}
            <label
              title="Add custom photo from computer"
              style={{
                width: '100%',
                height: '64px',
                borderRadius: '6px',
                border: '1.5px dashed var(--border-color)',
                backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2px',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-primary, #2563EB)';
                e.currentTarget.style.color = 'var(--accent-primary, #2563EB)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
            >
              <FiUploadCloud size={14} />
              <span style={{ fontSize: '0.53125rem', fontWeight: 600 }}>+ Upload</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  handleUploadCondoPhoto(e, activeCondoSlot !== null ? activeCondoSlot : undefined)
                }
                style={{ display: 'none' }}
              />
            </label>
          </div>

          {/* Bottom subtle switch folder option */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '2px',
              paddingTop: '5px',
              borderTop: '1px solid var(--border-color)',
            }}
          >
            <span
              style={{
                fontSize: '0.5625rem',
                color: 'var(--text-muted)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '190px',
              }}
              title={matchedCondoInfo?.folder_path}
            >
              {matchedCondoInfo?.matched_folder ? `Folder: ${matchedCondoInfo.matched_folder}` : 'Condo Directory'}
            </span>
            <button
              type="button"
              onClick={handleChooseFolder}
              title="Choose another condo folder on Mac"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: '0.5625rem',
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: 0,
              }}
            >
              Switch Folder...
            </button>
          </div>
        </div>
      )}

      {/* 3 Condo Photo Slots (Min: 3, Max: 3) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.55rem', marginTop: '2px' }}>
        {[1, 2, 3].map((num) => {
          const img = condoSlots[num - 1];
          const isSlotActive = activeCondoSlot === num - 1 && showFolderPicker;

          return (
            <div
              key={num}
              onClick={() => {
                setActiveCondoSlot(num - 1);
                setShowFolderPicker(true);
              }}
              title={img?.filename ? `${img.filename} — Click to change` : `Slot #${num} — Click to pick photo`}
              style={{
                position: 'relative',
                borderRadius: '8px',
                overflow: 'hidden',
                height: '78px',
                backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : '#F8FAFC',
                border: isSlotActive
                  ? '2px solid var(--accent-primary, #2563EB)'
                  : '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'none',
                transition: 'all 0.15s ease',
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: '4px',
                  left: '4px',
                  backgroundColor: 'rgba(0, 0, 0, 0.65)',
                  backdropFilter: 'blur(4px)',
                  color: '#FFFFFF',
                  fontSize: '0.5625rem',
                  fontWeight: 600,
                  padding: '1px 5px',
                  borderRadius: '4px',
                  zIndex: 2,
                }}
              >
                #{num}
              </span>

              {img?.data_url ? (
                <>
                  <img
                    src={img.data_url}
                    alt={img.filename || `Condo ${num}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  {/* Remove button to clear this slot */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveCondoSlot(num - 1);
                      setActiveCondoSlot(num - 1);
                      setShowFolderPicker(true);
                    }}
                    title="Remove this photo"
                    style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(0, 0, 0, 0.65)',
                      backdropFilter: 'blur(3px)',
                      border: 'none',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      zIndex: 3,
                    }}
                  >
                    <FiX size={10} />
                  </button>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                  <FiPlus size={16} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontSize: '0.5625rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    Pick #{num}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '7px',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              color: '#10B981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <FiImage size={14} />
          </div>
          <div>
            <div style={{ fontSize: '0.78125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Image(s) to Enhance
            </div>
            <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
              Target: Tab Group worker photos
            </div>
          </div>
        </div>

        <span
          style={{
            fontSize: '0.5625rem',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: '10px',
            backgroundColor: activeImages.length > 0 ? 'rgba(16, 185, 129, 0.12)' : isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
            color: activeImages.length > 0 ? '#10B981' : 'var(--text-secondary)',
            border: activeImages.length > 0 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-color)',
            letterSpacing: '0.02em',
          }}
        >
          {activeImages.length} of {receivedImages.length} Active
        </span>
      </div>

      <Select
        options={[
          { value: 'all', label: `All Photos from "Get Images" (${receivedImages.length})` },
          { value: 'hero_only', label: 'Primary Hero Photo Only (Photo #1)' },
          { value: 'selected', label: `Select Specific Photos (${selectedImageIndices.length} picked)` },
        ]}
        value={
          imageSourceMode === 'hero_only'
            ? 'hero_only'
            : imageSourceMode === 'selected'
            ? 'selected'
            : 'all'
        }
        onChange={(val) => {
          setImageSourceMode(val as any);
          if (val === 'all') {
            const allIdx = receivedImages.map((_, i) => i + 1);
            setSelectedImageIndices(allIdx);
            updateMultiConfig({ imageSourceMode: 'all', selectedImageIndices: allIdx });
          } else if (val === 'hero_only') {
            setSelectedImageIndices([1]);
            updateMultiConfig({ imageSourceMode: 'hero_only', selectedImageIndices: [1] });
          } else {
            updateConfig('imageSourceMode', val);
          }
        }}
      />

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
            const isChecked = selectedImageIndices.includes(photoNum);
            return (
              <div
                key={idx}
                onClick={() => {
                  let nextIndices: number[];
                  if (isChecked) {
                    nextIndices = selectedImageIndices.length > 1
                      ? selectedImageIndices.filter((n) => n !== photoNum)
                      : selectedImageIndices;
                  } else {
                    nextIndices = [...selectedImageIndices, photoNum].sort((a, b) => a - b);
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
                  borderRadius: '6px',
                  overflow: 'hidden',
                  border: isChecked ? '2px solid #10B981' : isDark ? '1px solid #334155' : '1px solid #CBD5E1',
                  background: isDark ? '#1E293B' : '#E2E8F0',
                  cursor: 'pointer',
                  opacity: isChecked ? 1 : 0.45,
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                }}
                title={`Photo #${photoNum} — Click to toggle`}
              >
                <img
                  src={img.url}
                  alt={img.filename || `Photo #${photoNum}`}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                  loading="lazy"
                />
                <span
                  style={{
                    position: 'absolute',
                    top: '3px',
                    left: '3px',
                    background: isChecked ? '#10B981' : 'rgba(0,0,0,0.6)',
                    color: '#fff',
                    fontSize: '0.55rem',
                    fontWeight: 800,
                    width: '15px',
                    height: '15px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.4)',
                  }}
                >
                  {isChecked ? '✓' : ''}
                </span>
                <span
                  style={{
                    position: 'absolute',
                    bottom: '3px',
                    right: '3px',
                    background: 'rgba(0,0,0,0.75)',
                    color: '#fff',
                    fontSize: '0.5rem',
                    fontWeight: 700,
                    padding: '1px 4px',
                    borderRadius: '3px',
                    backdropFilter: 'blur(2px)',
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
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '2rem' }}>
      {/* Node Header Banner */}
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
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
            {isTabGroupNode ? (
              <>
                <span>Connected to {boxConfig.browserProfileName || connectedProfileName || activeProfile?.display_name || 'Note Zin Wai'} ({boxConfig.browserProfileKey || activeProfile?.profile_key || 'Pro'})</span>
                {connectedProfileNodeId && onOpenProfileNode && (
                  <button
                    type="button"
                    onClick={() => onOpenProfileNode(connectedProfileNodeId)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: isDark ? '#93C5FD' : '#2563EB',
                      fontSize: '0.6875rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2px',
                      textDecoration: 'underline',
                    }}
                  >
                    <FiArrowLeft size={10} /> View Profile
                  </button>
                )}
                {boxConfig.reuseSessionTabs !== false && (
                  <span
                    style={{
                      fontSize: '0.625rem',
                      fontWeight: 600,
                      color: '#10B981',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <span>•</span>
                    <span>💾 Memorized Tabs Bound</span>
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
          borderRadius: '12px',
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#FFFFFF',
          border: '1px solid var(--border-color)',
          boxShadow: isDark ? '0 1px 3px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.05)',
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
            {/* Context Card: Project Name + Profile + Settings */}
            {boxConfig.showCondoProjectCard !== false && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.65rem 0.875rem',
                borderRadius: '10px',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#F8FAFC',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
                <div
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFFFFF',
                    flexShrink: 0,
                  }}
                >
                  <FiZap size={15} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {condoName}
                  </div>
                  <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px', marginTop: '1px' }}>
                    <span>Profile: {boxConfig.browserProfileName || 'Hsu'}</span>
                    <span>•</span>
                    <span style={{ color: '#10B981', fontWeight: 600 }}>● Active</span>
                  </div>
                </div>
              </div>

              {onOpenSettingsSidebox && (
                <button
                  type="button"
                  onClick={() => {
                    setShowPromptViewSidebox(false);
                    onOpenSettingsSidebox();
                  }}
                  title="Configure in Settings"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    color: '#F59E0B',
                    fontSize: '0.625rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    flexShrink: 0,
                  }}
                >
                  <FiSettings size={11} />
                  <span>Settings</span>
                </button>
              )}
            </div>
            )}

            {/* ── MODULE 1: REFERENCE PHOTO CARD (Hero only) ── */}
            {isHeroNode && boxConfig.useReferenceImage !== false && renderReferenceImageCard()}

            {/* ── MODULE 2: CONDO PHOTOS CARD (Hero only) ── */}
            {isHeroNode && boxConfig.useCondoImages !== false && renderCondoPhotosCard()}

            {/* ── MODULE 4: IMAGES TO ENHANCE CARD (if enabled) ── */}
            {Boolean(boxConfig.showImagesToEnhance) && renderImagesToEnhanceCard()}

            {/* ── MODULE 3: PROMPT CONFIGURATION CARD ── */}
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
                        {isHeroNode ? 'Prompt Configuration' : 'Enhancement Prompt'}
                      </div>
                      <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                        {isHeroNode
                          ? `${(boxConfig.stagingMode === 'direct_tab2' || boxConfig.skipTab1) ? 'Direct to Tab 2' : '2-Stage Browser'} • ${promptSourceMode === 'upstream_ai' ? 'Canvas AI' : promptSourceMode === 'custom' ? 'Custom Prompt' : 'Template'} (Set in Settings)`
                          : 'Worker tab enhancement template'}
                      </div>
                    </div>
                  </div>

                  {/* Mode Indicator Badge (Only relevant for Hero nodes) */}
                  {isHeroNode && (
                    <span
                      style={{
                        fontSize: '0.5625rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '10px',
                        backgroundColor: (boxConfig.stagingMode === 'direct_tab2' || boxConfig.skipTab1)
                          ? 'rgba(59, 130, 246, 0.15)'
                          : (isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9'),
                        color: (boxConfig.stagingMode === 'direct_tab2' || boxConfig.skipTab1)
                          ? '#3B82F6'
                          : 'var(--text-secondary)',
                        border: (boxConfig.stagingMode === 'direct_tab2' || boxConfig.skipTab1)
                          ? '1px solid rgba(59, 130, 246, 0.3)'
                          : '1px solid var(--border-color)',
                        letterSpacing: '0.02em',
                      }}
                      title="Staging flow mode can only be changed in Settings"
                    >
                      {(boxConfig.stagingMode === 'direct_tab2' || boxConfig.skipTab1) ? 'Direct' : '2-Stage'}
                    </span>
                  )}
                </div>

                {/* 1. Prompt Template Mode */}
                {promptSourceMode === 'preset' && (
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
                )}

                {/* 2. AI Generate (Upstream AI Node) Mode */}
                {promptSourceMode === 'upstream_ai' && (
                  <Select
                    options={effectiveUpstreamPrompts.map((p) => ({
                      value: p.id,
                      label: `🤖 ${p.title} (AI Model)`,
                    }))}
                    value={selectedUpstreamAiId || effectiveUpstreamPrompts[0]?.id}
                    onChange={(val) => {
                      const strVal = String(val);
                      setSelectedUpstreamAiId(strVal);
                      updateMultiConfig({
                        selectedUpstreamAiId: strVal,
                      });
                    }}
                  />
                )}

                {/* 3. Custom Prompt Mode */}
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
                      border: '1px solid var(--border-color)',
                      backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#FFFFFF',
                      color: 'var(--text-primary)',
                      resize: 'vertical',
                    }}
                  />
                )}

                {/* Condo Project Identification Bar with Reload Button */}
                {isHeroNode && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      backgroundColor: isDark ? 'rgba(0, 0, 0, 0.22)' : 'rgba(0, 0, 0, 0.03)',
                      border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
                      fontSize: '0.6875rem',
                      marginTop: '2px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, overflow: 'hidden' }}>
                      <span style={{ fontSize: '13px', flexShrink: 0 }}>🏢</span>
                      <span
                        style={{
                          fontWeight: 600,
                          color: (condoSearchQuery || condoName) ? 'var(--text-primary)' : '#EF4444',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={(condoSearchQuery || condoName) ? `Condo: ${condoSearchQuery || condoName}` : 'No condo name extracted yet'}
                      >
                        {(condoSearchQuery || condoName) ? (condoSearchQuery || condoName) : 'No condo name extracted'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleReloadCondoName}
                      disabled={isReloadingCondoName}
                      title="Reload / extract condo name from post"
                      style={{
                        flexShrink: 0,
                        height: '24px',
                        padding: '0 8px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#FFFFFF',
                        color: 'var(--text-primary)',
                        fontSize: '0.625rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: isReloadingCondoName ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <FiRefreshCw className={isReloadingCondoName ? 'spin' : ''} style={{ fontSize: '10px' }} />
                      <span>{isReloadingCondoName ? 'Loading...' : 'Reload Condo'}</span>
                    </button>
                  </div>
                )}

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
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC',
                      color: 'var(--text-primary)',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {promptSourceMode === 'upstream_ai' ? (
                      <FiZap size={13} style={{ color: '#10B981' }} />
                    ) : (
                      <FiFileText size={13} style={{ color: '#3B82F6' }} />
                    )}
                    <span>
                      {promptSourceMode === 'upstream_ai'
                        ? 'View AI Generated Prompt'
                        : promptSourceMode === 'custom'
                        ? 'View Custom Prompt'
                        : 'View Prompt Template'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyPrompt}
                    title="Copy full prompt"
                    style={{
                      height: '32px',
                      padding: '0 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC',
                      color: isCopied ? '#10B981' : 'var(--text-secondary)',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    {isCopied ? <FiCheck size={12} color="#10B981" /> : <FiCopy size={12} />}
                    <span>{isCopied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                {/* Auto-Run Toggle & Status Bar (FB Hero Node) */}
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



            {/* ── 4. Generated Hero Advertisement Preview Card ── */}
            {latestHeroImage && Boolean((condoName || condoSearchQuery) && (
              !latestHeroImage.condoName ||
              (condoName || condoSearchQuery).toLowerCase().includes(latestHeroImage.condoName.toLowerCase()) ||
              latestHeroImage.condoName.toLowerCase().includes((condoName || condoSearchQuery).toLowerCase())
            )) && (
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
                        Generated Hero Image
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
                        {latestHeroImage.condoName || condoName || 'Facebook Hero'}
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
                        fetch('http://127.0.0.1:9224/two-stage-status', { method: 'DELETE' }).catch(() => {});
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
                  onClick={() => window.open(latestHeroImage.url, '_blank')}
                  title="Click to view full 2400×1200 image in new tab"
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

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => window.open(latestHeroImage.url, '_blank')}
                    style={{
                      flex: 1,
                      height: '28px',
                      borderRadius: '6px',
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
                      border: '1px solid var(--border-color)',
                      color: isDark ? '#F3F4F6' : '#1E293B',
                      fontSize: '0.625rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                    }}
                  >
                    <FiMaximize2 size={11} /> Open Full Size
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      fetch(`http://127.0.0.1:9224/reveal-file?file=${encodeURIComponent(latestHeroImage.fileName || '')}`).catch(() => {});
                    }}
                    style={{
                      flex: 1,
                      height: '28px',
                      borderRadius: '6px',
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
                      border: '1px solid var(--border-color)',
                      color: isDark ? '#F3F4F6' : '#1E293B',
                      fontSize: '0.625rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                    }}
                  >
                    <FiFolder size={11} /> Reveal in Finder
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

                <button
                  type="button"
                  onClick={() => {
                    const nextMode = promptSourceMode === 'custom' ? 'preset' : 'custom';
                    setPromptSourceMode(nextMode);
                    updateConfig('promptSourceMode', nextMode);
                  }}
                  style={{
                    fontSize: '0.5625rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '10px',
                    backgroundColor: promptSourceMode === 'custom' ? 'rgba(139, 92, 246, 0.15)' : (isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9'),
                    color: promptSourceMode === 'custom' ? '#8B5CF6' : 'var(--text-secondary)',
                    border: promptSourceMode === 'custom' ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid var(--border-color)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    letterSpacing: '0.02em',
                  }}
                  title="Click to toggle Custom / Preset mode"
                >
                  {promptSourceMode === 'custom' ? 'Custom' : 'Preset'}
                </button>
              </div>

              {promptSourceMode !== 'custom' ? (
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
              ) : (
                <textarea
                  rows={3}
                  value={customPromptText}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustomPromptText(val);
                    setPersistedPromptSelection('custom_prompt', val, val);
                    updateConfig('browserCustomPrompt', val);
                  }}
                  placeholder="Enter custom image enhancement prompt..."
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.65rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: isDark ? 'rgba(0, 0, 0, 0.25)' : '#FFFFFF',
                    color: 'var(--text-color)',
                    fontSize: '0.6875rem',
                    fontFamily: 'inherit',
                  }}
                />
              )}

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
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC',
                    color: 'var(--text-primary)',
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <FiFileText size={13} style={{ color: '#3B82F6' }} />
                  <span>View Prompt Template</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  title="Copy full prompt"
                  style={{
                    height: '32px',
                    padding: '0 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC',
                    color: isCopied ? '#10B981' : 'var(--text-secondary)',
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
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

        {/* Two-Stage Hero Feedback Banner (when running or status message present) */}
        {isHeroNode && twoStageMessage && (
          <div
            style={{
              fontSize: '0.6875rem',
              fontWeight: 500,
              padding: '7px 11px',
              borderRadius: '8px',
              backgroundColor: isDark ? 'rgba(59, 130, 246, 0.12)' : 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              color: isDark ? '#93C5FD' : '#2563EB',
              lineHeight: 1.35,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
            }}
          >
            <span>{twoStageMessage}</span>
            {isRunningTwoStage && (
              <button
                type="button"
                onClick={handleStopGroupAutomation}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#EF4444',
                  cursor: 'pointer',
                  fontSize: '0.625rem',
                  fontWeight: 700,
                  textDecoration: 'underline',
                  padding: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                Cancel
              </button>
            )}
          </div>
        )}

        {/* Run Action Button (Theme Primary Clean Apple Style) */}
        <button
          type="button"
          disabled={isAutomating || isRunningTwoStage}
          onClick={() => {
            if (isHeroNode) {
              handleRunTwoStageTest();
            } else {
              setSelectedGroupName(currentGroup.name || boxConfig.browserGroupName || 'Enhance IMG');
              handleStartGroupAutomation();
            }
          }}
          style={{
            width: '100%',
            height: '38px',
            borderRadius: '8px',
            border: '1px solid var(--accent-primary, #2563EB)',
            backgroundColor: (isAutomating || isRunningTwoStage)
              ? 'rgba(37, 99, 235, 0.6)'
              : 'var(--accent-primary, #2563EB)',
            color: '#FFFFFF',
            fontSize: '0.8125rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            cursor: (isAutomating || isRunningTwoStage) ? 'not-allowed' : 'pointer',
            boxShadow: 'none',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            if (!isAutomating && !isRunningTwoStage) {
              e.currentTarget.style.backgroundColor = 'var(--accent-primary-hover, #1D4ED8)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isAutomating && !isRunningTwoStage) {
              e.currentTarget.style.backgroundColor = 'var(--accent-primary, #2563EB)';
            }
          }}
        >
          {isAutomating || isRunningTwoStage ? (
            <>
              <FiLoader className="animate-spin" size={14} />
              <span>
                {isHeroNode
                  ? 'Generating Hero Image (1 Ref + 3 Condo Photos)...'
                  : `Processing ${activeImages.length} Images in ${boxConfig.workerTabCount || (isHeroNode ? 1 : 4)} Tabs...`}
              </span>
            </>
          ) : (
            <>
              <FiPlay size={13} />
              <span>
                {isHeroNode
                  ? `Run ${currentGroup.name || 'FB Hero'} (1 Ref + 3 Condo Photos · 1 Tab)`
                  : `Run ${currentGroup.name || 'Enhance IMG'} (${activeImages.length} Images · ${boxConfig.workerTabCount || (isHeroNode ? 1 : 4)} Tabs)`}
              </span>
            </>
          )}
        </button>

        {/* Stop Automation Button */}
        {(isAutomating || isRunningTwoStage) && (
          <Button
            size="sm"
            variant="danger"
            onClick={handleStopGroupAutomation}
            style={{
              fontSize: '0.6875rem',
              fontWeight: 600,
              width: '100%',
              marginTop: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <FiSquare size={11} /> Stop Automation
          </Button>
        )}
      </div>

      {/* SECTION C — CHROME TAB GROUPS MULTI-PIPELINE (RELATIVE TO SELECTED PROFILE) */}
      {(isHeroNode ? Boolean(boxConfig.showTabGroupsPipelines) : boxConfig.showTabGroupsPipelines !== false) && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FiLayers style={{ color: 'var(--text-muted)' }} /> Tab Groups & Pipelines ({activeProfile?.display_name || 'Chrome'})
          </label>
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
            <FiRefreshCw size={10} style={{ marginRight: '3px' }} /> Refresh Groups
          </Button>
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
            const isHero = group.name.toLowerCase().includes('hero') || group.name.toLowerCase().includes('fb');
            const groupBg = isDark ? 'var(--bg-surface)' : '#F8FAFC';
            const groupBorder = '1px solid var(--border-color)';
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

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (tabs.length > 0) {
                        try {
                          const isHeroGrp = (group.name || '').toLowerCase().includes('hero');
                          const grpCount = isHeroGrp ? 1 : (boxConfig.workerTabCount || tabs.length || 4);
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
                        } catch (e) {}
                      }
                    }}
                    style={{ fontSize: '0.625rem', padding: '2px 7px', height: '22px' }}
                  >
                    <FiExternalLink size={10} style={{ marginRight: '3px' }} /> Focus Group
                  </Button>
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
            }}
          >
            <FiCheckCircle size={12} style={{ color: '#10B981', flexShrink: 0 }} />
            <span>{automationMessage || twoStageMessage}</span>
          </div>
        )}
      </div>
      )}

      {/* SECTION: ENHANCED IMAGES RESULTS (Downloaded to Disk) */}
      {receivedImages.length > 0 && enhancedImages.length > 0 && (
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  backgroundColor: '#10B981',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 700,
                }}
              >
                ✓
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10B981' }}>
                Enhanced Images ({enhancedImages.length} Photos)
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  fetch('http://127.0.0.1:9224/reveal-file').catch(() => {});
                }}
                style={{
                  padding: '2px 8px',
                  fontSize: '0.625rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  borderColor: 'rgba(16, 185, 129, 0.35)',
                }}
                title="Open Downloads folder in macOS Finder"
              >
                <FiFolder size={11} style={{ color: '#10B981' }} />
                <span>Downloads</span>
              </Button>
            </div>
          </div>

          {/* Grid of Enhanced Images */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '0.5rem',
              maxHeight: '380px',
              overflowY: 'auto',
              paddingRight: '2px',
            }}
          >
            {enhancedImages.map((img, idx) => (
              <div
                key={img.filename || idx}
                style={{
                  position: 'relative',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid var(--border-color)',
                  backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                {/* Image Thumbnail with 4:5 aspect ratio */}
                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: '4/5',
                    backgroundColor: isDark ? '#1E293B' : '#E2E8F0',
                    overflow: 'hidden',
                  }}
                >
                  <img
                    src={img.url}
                    alt={img.filename}
                    loading="lazy"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                  {/* Position Badge */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '6px',
                      left: '6px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(0, 0, 0, 0.7)',
                      color: '#FFFFFF',
                      fontSize: '0.625rem',
                      fontWeight: 700,
                      backdropFilter: 'blur(4px)',
                    }}
                  >
                    #{img.position || idx + 1}
                  </div>
                  {/* Enhanced Status Pill */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '6px',
                      right: '6px',
                      padding: '2px 5px',
                      borderRadius: '4px',
                      backgroundColor: '#10B981',
                      color: '#FFFFFF',
                      fontSize: '0.5625rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
                    }}
                  >
                    ✓ Enhanced
                  </div>
                </div>

                {/* Footer Actions */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4px 6px',
                    fontSize: '0.625rem',
                    color: 'var(--text-secondary)',
                    backgroundColor: isDark ? 'rgba(0, 0, 0, 0.3)' : '#F1F5F9',
                  }}
                >
                  <span style={{ fontSize: '0.5625rem', fontWeight: 500 }}>
                    {Math.round(((img as any).size_bytes || img.size || 0) / 1024)} KB
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        fetch(`http://127.0.0.1:9224/reveal-file?file=${encodeURIComponent(img.filename)}`).catch(() => {});
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'inherit',
                        cursor: 'pointer',
                        padding: '2px',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      title="Reveal in Finder"
                    >
                      <FiFolder size={11} />
                    </button>
                    <a
                      href={img.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        color: '#10B981',
                        display: 'flex',
                        alignItems: 'center',
                        textDecoration: 'none',
                        padding: '2px',
                      }}
                      title="View Full Resolution"
                    >
                      <FiExternalLink size={11} />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION G — SMART IMAGE QUEUE */}
      {(() => {
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                Smart Image Queue ({displayQueueItems.length} Images)
              </label>
              <Button
                size="sm"
                variant="secondary"
                onClick={loadQueue}
                style={{ padding: '2px 6px', fontSize: '0.625rem' }}
              >
                <FiRefreshCw size={10} />
              </Button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: displayQueueItems.length > 1 ? 'repeat(2, 1fr)' : '1fr',
                gap: '6px',
              }}
            >
              {displayQueueItems.map((job) => {
                const isCompleted = job.status === 'COMPLETED';
                const isReady = job.status === 'READY_FOR_USER';
                const isLocal = job.status === 'PROCESSING_LOCAL';
                const isFailed = job.status === 'FAILED';

                const badgeColor = isCompleted
                  ? '#10B981'
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
                    title={`Image #${job.original_position} · Status: ${job.status}`}
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
                          width: '18px',
                          height: '18px',
                          borderRadius: '4px',
                          backgroundColor: isDark ? '#0F172A' : '#E2E8F0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.625rem',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
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
                        {isReady ? 'Ready' : isCompleted ? 'Done' : isLocal ? 'Local' : job.status}
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

      {/* ── PROMPT VIEW SIDEBOX (SLIDE-OVER PANEL LIKE SETTINGS) ── */}
      {showPromptViewSidebox && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            bottom: 0,
            right: '380px', // sits smoothly right alongside the 380px main sidebar inspector
            width: '440px',
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
              borderBottom: 'none',
              backgroundColor: isDark ? 'var(--bg-main)' : '#FFFFFF',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <div
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(59, 130, 246, 0.12)',
                  color: '#3B82F6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FiFileText size={15} />
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                  Prompt Template Viewer
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {promptOptions.find((p) => String(p.id).toLowerCase() === selectedPromptKey.toLowerCase())?.name || 'Active Prompt Template'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowPromptViewSidebox(false)}
              title="Close Prompt Viewer"
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

          {/* Body */}
          {/* Main Scrollable Body with Direct Text */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1rem 1.25rem',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize: '0.75rem',
              lineHeight: '1.65',
              color: 'var(--text-primary)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {resolvedPromptPreview || currentPromptText || 'No prompt content available.'}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '0.75rem 1.125rem',
              borderTop: 'none',
              backgroundColor: isDark ? 'var(--bg-main)' : '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
            }}
          >
            <Button
              size="sm"
              variant="primary"
              onClick={handleCopyPrompt}
              style={{ fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              {isCopied ? <FiCheck size={13} /> : <FiCopy size={13} />}
              <span>{isCopied ? 'Copied' : 'Copy Prompt'}</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
