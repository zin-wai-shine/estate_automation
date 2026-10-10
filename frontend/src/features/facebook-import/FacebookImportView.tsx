import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import JSZip from 'jszip';
import type { Property } from '../../types';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal, useScrollLock } from '../../components/ui/Modal';
import { useTheme } from '../../context/ThemeContext';
import {
  FiDownload,
  FiExternalLink,
  FiCopy,
  FiCheck,
  FiAlertCircle,
  FiAlertTriangle,
  FiRefreshCw,
  FiMonitor,
  FiChevronDown,
  FiChevronUp,
  FiTrash2,
  FiSave,
  FiUploadCloud,
  FiImage,
  FiSliders,
  FiCode,
  FiEye,
  FiEyeOff,
  FiRotateCcw,
  FiInfo,
  FiX,
  FiZap,
  FiEdit3,
  FiGitBranch,
  FiDownloadCloud,
  FiLayers,
  FiCpu,
  FiPlus,
  FiFileText,
  FiMaximize2,
  FiActivity,
  FiChevronLeft,
  FiChevronRight,
  FiZoomIn,
  FiZoomOut,
} from 'react-icons/fi';
import { FaFacebook } from 'react-icons/fa';
import { SiGooglegemini } from 'react-icons/si';
import { HiSparkles } from 'react-icons/hi2';
import type { PromptTemplate } from '../../types';
import { CustomDropdown } from '../../components/ui/CustomDropdown';
import {
  FacebookWorkflowCanvas,
  loadSavedFacebookWorkflowConfig,
  type FacebookWorkflowConfig,
  type DynamicAIBoxConfig,
} from './FacebookWorkflowCanvas';
import { RunwareIcon, LaoZhangIcon } from './AITrainingChatbot';
import {
  getAIModelDisplayName,
  isImageAIBox,
  isAIBoxConnected,
  isContentConnectedAIBox,
  isImageConnectedAIBox,
} from './aiModelUtils';
import { AIImageStudio, type AttachedPhotoItem } from './AIImageStudio';
import {
  getSavedWorkflowFormats,
  saveWorkflowFormatsList,
  getActiveWorkflowFormat,
  getActiveWorkflowFormatId,
  setActiveWorkflowFormatId,
  type WorkflowFormat,
} from '../workflow/workflowFormats';

const DEFAULT_PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 1,
    name: 'Facebook Rental Listing Copy (Thai/English)',
    category: 'FACEBOOK_RENT',
    version: 'V1.2',
    active: true,
    templateText:
      'Generate an attractive Facebook real estate rental post for a condo in Bangkok.\nTitle: {title}\nPrice: {price}\nLocation: {location}\nInclude high-converting CTA and relevant hashtags.',
  },
  {
    id: 2,
    name: 'TikTok Short Video Script & Hook Generator',
    category: 'TIKTOK',
    version: 'V1.0',
    active: true,
    templateText:
      'Create a viral 15-second TikTok video script for property listing {title}.\nStart with a high-curiosity hook, list 3 key highlights, and end with Line ID CTA.',
  },
  {
    id: 3,
    name: 'Facebook Property Sale Copy Template',
    category: 'FACEBOOK_SALE',
    version: 'V1.0',
    active: true,
    templateText:
      'Write a professional sales copy for property sale: {title}.\nHighlight investment yield, BTS access, and price {price}.',
  },
];

const OpenAIIcon: React.FC<{ size?: number; color?: string }> = ({ size = 15, color = '#10A37F' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{ color, flexShrink: 0 }}>
    <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.259 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7466-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.5045 4.5045 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.8956zm16.0993 3.8558L12.5973 8.3829l2.02-1.1638a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.402-.686zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.407 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813v6.7227zm1.1408-2.8252l2.5526-1.4727 2.5526 1.4727v2.9454l-2.5526 1.4727-2.5526-1.4727z" />
  </svg>
);

interface FacebookImportViewProps {
  onSaveToInbox?: (property: Partial<Property>) => void;
  onNavigateTab?: (tab: string) => void;
}

interface ExtractedImage {
  index: number;
  facebook_photo_id?: string;
  source_url: string;
  stored_url: string;
  width: number;
  height: number;
  status: string;
}

interface SourceDetails {
  platform: string;
  original_url: string;
  canonical_url: string;
  source_type: string;
  source_name: string;
  post_id: string;
  created_time: string;
  extraction_method: string;
}

interface PropertyData {
  project_name: string;
  listing_type: string;
  price: string;
  currency: string;
  bedrooms: string;
  bathrooms: string;
  size_sqm: string;
  floor: string;
  building: string;
  unit_number: string;
  furnished: string;
  nearest_transit: string;
  location: string;
  move_in_status: string;
  contact_name: string;
  contact_phone: string;
  contact_line: string;
}

interface ActivityLog {
  timestamp: string;
  message: string;
  level: 'info' | 'warn' | 'error' | 'success';
}

const FB_IMPORT_SESSION_KEY = 'estate_facebook_import_session_v1';

interface FacebookImportSessionState {
  url: string;
  source: SourceDetails | null;
  caption: string;
  languages: string[];
  images: ExtractedImage[];
  propertyData: PropertyData;
  currentStepIndex: number;
  logs: ActivityLog[];
  pipelineError: string | null;
  pipelineErrorCode: string | null;
  browserState: string;
  aiGeneratedOutputs: Record<string, string>;
  aiGeneratedCopy: string;
  activeAIBoxId: string;
  selectedFormatId: string;
  manualMode: boolean;
  autoImport: boolean;
  preferredMethod: 'auto' | 'meta_graph_api' | 'openclaw_browser';
  enhancedPhotos?: Record<number, string>;
}

const loadSavedImportSession = (): FacebookImportSessionState | null => {
  try {
    const raw = localStorage.getItem(FB_IMPORT_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as FacebookImportSessionState;
    }
  } catch (err) {
    console.warn('Failed to parse saved Facebook import session:', err);
  }
  return null;
};

const PIPELINE_STEPS = [
  { id: 'url_received', label: 'URL Received' },
  { id: 'resolving', label: 'Resolving' },
  { id: 'opening_browser', label: 'Opening Facebook' },
  { id: 'target_found', label: 'Target Post Found' },
  { id: 'caption_extracted', label: 'Caption Extracted' },
  { id: 'photos_detected', label: 'Photos Detected' },
  { id: 'verifying_photos', label: 'Verifying Photos' },
  { id: 'downloading_media', label: 'Downloading Media' },
  { id: 'ai_analysis', label: 'AI Analysis' },
  { id: 'complete', label: 'Complete' },
];

export const FacebookImportView: React.FC<FacebookImportViewProps> = ({
  onSaveToInbox,
  onNavigateTab,
}) => {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';

  // Saved Session Hydration (restores all imported info across navigation and page reloads)
  const [savedSession] = useState<FacebookImportSessionState | null>(() => loadSavedImportSession());

  // Input & Modes
  const [url, setUrl] = useState<string>(() => savedSession?.url || '');
  const [autoImport, setAutoImport] = useState<boolean>(() => savedSession?.autoImport ?? true);
  const [preferredMethod, setPreferredMethod] = useState<'auto' | 'meta_graph_api' | 'openclaw_browser'>(
    () => savedSession?.preferredMethod || 'auto'
  );
  const [showInfo, setShowInfo] = useState(false);
  const [showRawJsonModal, setShowRawJsonModal] = useState(false);
  const [showLiveBrowserModal, setShowLiveBrowserModal] = useState(false);
  const [showPipelineModal, setShowPipelineModal] = useState(false);
  const [showPostContentModal, setShowPostContentModal] = useState(false);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [previewImageIndex, setPreviewImageIndex] = useState<number | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(1);

  // Top Nav Bar Portal Targets
  const [headerActionEl, setHeaderActionEl] = useState<HTMLElement | null>(null);
  const [headerCenterEl, setHeaderCenterEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setHeaderActionEl(document.getElementById('header-action-portal'));
    setHeaderCenterEl(document.getElementById('header-center-portal'));
  }, []);

  // Status & Pipeline
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(() => savedSession?.currentStepIndex ?? -1);
  const [pipelineError, setPipelineError] = useState<string | null>(() => savedSession?.pipelineError ?? null);
  const [pipelineErrorCode, setPipelineErrorCode] = useState<string | null>(() => savedSession?.pipelineErrorCode ?? null);
  const [browserState, setBrowserState] = useState<string>(() => savedSession?.browserState || 'Browser Ready');
  const [logs, setLogs] = useState<ActivityLog[]>(() => savedSession?.logs || []);

  // Extraction Result State
  const [source, setSource] = useState<SourceDetails | null>(() => savedSession?.source || null);
  const [caption, setCaption] = useState<string>(() => savedSession?.caption || '');
  const [languages, setLanguages] = useState<string[]>(() => savedSession?.languages || []);
  const [images, setImages] = useState<ExtractedImage[]>(() => savedSession?.images || []);
  const [propertyData, setPropertyData] = useState<PropertyData>(
    () =>
      savedSession?.propertyData || {
        project_name: '',
        listing_type: 'RENT',
        price: '',
        currency: 'THB',
        bedrooms: '',
        bathrooms: '',
        size_sqm: '',
        floor: '',
        building: '',
        unit_number: '',
        furnished: '',
        nearest_transit: '',
        location: '',
        move_in_status: '',
        contact_name: '',
        contact_phone: '',
        contact_line: '',
      }
  );

  // UI helpers
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [copiedImageIndex, setCopiedImageIndex] = useState<number | null>(null);
  const [savedSuccessMsg, setSavedSuccessMsg] = useState(false);
  const [manualMode, setManualMode] = useState<boolean>(() => savedSession?.manualMode || false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Facebook Workflow Formats Selection & State
  const [workflowFormats, setWorkflowFormats] = useState<WorkflowFormat[]>(() => getSavedWorkflowFormats());
  const [selectedFormatId, setSelectedFormatId] = useState<string>(
    () => savedSession?.selectedFormatId || getActiveWorkflowFormatId()
  );
  const [activeFormat, setActiveFormat] = useState<WorkflowFormat>(() => {
    const list = getSavedWorkflowFormats();
    const targetId = savedSession?.selectedFormatId || getActiveWorkflowFormatId();
    return list.find((f) => f.id === targetId) || getActiveWorkflowFormat();
  });
  const [workflowConfig, setWorkflowConfig] = useState<FacebookWorkflowConfig>(() => {
    const list = getSavedWorkflowFormats();
    const targetId = savedSession?.selectedFormatId || getActiveWorkflowFormatId();
    const found = list.find((f) => f.id === targetId) || getActiveWorkflowFormat();
    return found.config || loadSavedFacebookWorkflowConfig();
  });
  const [activeAIBoxId, setActiveAIBoxId] = useState<string>(() => {
    if (savedSession?.activeAIBoxId) return savedSession.activeAIBoxId;
    const activeFmt = getActiveWorkflowFormat();
    const first = activeFmt.config?.aiBoxes?.find((b) => b.enabled) || activeFmt.config?.aiBoxes?.[0];
    return first ? first.id : 'ai-box-rental';
  });
  const [aiGeneratedOutputs, setAiGeneratedOutputs] = useState<Record<string, string>>(
    () => savedSession?.aiGeneratedOutputs || {}
  );
  const [aiBoxGenerating, setAiBoxGenerating] = useState<Record<string, boolean>>({});
  const [showWorkflowCanvasModal, setShowWorkflowCanvasModal] = useState(false);
  const [viewingResultBox, setViewingResultBox] = useState<DynamicAIBoxConfig | null>(null);
  const [copiedBoxId, setCopiedBoxId] = useState<string | null>(null);

  // Reload formats when window/tab gains focus
  useEffect(() => {
    const handleRefreshFormats = () => {
      const savedList = getSavedWorkflowFormats();
      setWorkflowFormats(savedList);
      const activeId = getActiveWorkflowFormatId();
      const current = savedList.find((f) => f.id === activeId) || savedList[0];
      if (current) {
        setSelectedFormatId(current.id);
        setActiveFormat(current);
        setWorkflowConfig(current.config);
      }
    };
    window.addEventListener('focus', handleRefreshFormats);
    return () => window.removeEventListener('focus', handleRefreshFormats);
  }, []);

  const handleFormatChange = (newFormatId: string) => {
    setSelectedFormatId(newFormatId);
    setActiveWorkflowFormatId(newFormatId);
    const found = workflowFormats.find((f) => f.id === newFormatId);
    if (found) {
      setActiveFormat(found);
      setWorkflowConfig(found.config);
      const firstActive = found.config.aiBoxes.find((b) => b.enabled) || found.config.aiBoxes[0];
      if (firstActive) {
        setActiveAIBoxId(firstActive.id);
      }
      addLog(`Switched workflow format to: ${found.name}`, 'info');
    }
  };

  // AI Assistant & Prompt Templates (Google AI Studio & OpenAI)
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>(DEFAULT_PROMPT_TEMPLATES);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('1');
  const [aiProvider, setAiProvider] = useState<'google_ai' | 'openai' | 'laozhang_ai' | 'runware_ai'>('google_ai');
  const [generatedProvider, setGeneratedProvider] = useState<'google_ai' | 'openai' | 'laozhang_ai' | 'runware_ai' | null>(null);
  const [customPromptTweak, setCustomPromptTweak] = useState<string>('');
  const [showPromptTweak, setShowPromptTweak] = useState<boolean>(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState<boolean>(false);
  const [aiGeneratedCopy, setAiGeneratedCopy] = useState<string>(() => savedSession?.aiGeneratedCopy || '');
  const [copiedAiCopy, setCopiedAiCopy] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // AI Image Enhancement states
  const [enhancedPhotos, setEnhancedPhotos] = useState<Record<number, string>>(
    () => savedSession?.enhancedPhotos || {}
  );
  const [enhancingPhotos, setEnhancingPhotos] = useState<Record<number, boolean>>({});
  const [isEnhancingAllPhotos, setIsEnhancingAllPhotos] = useState(false);
  const [selectedImageAIBoxModal, setSelectedImageAIBoxModal] = useState<DynamicAIBoxConfig | null>(null);
  const [studioStartWithNewChat, setStudioStartWithNewChat] = useState(false);
  const [studioInitialImages, setStudioInitialImages] = useState<AttachedPhotoItem[]>([]);
  const [lightboxShowOriginal, setLightboxShowOriginal] = useState(false);
  const [hoveredPhotoIndex, setHoveredPhotoIndex] = useState<number | null>(null);

  const handleOpenImageStudio = (targetBox?: DynamicAIBoxConfig, specificPhoto?: ExtractedImage) => {
    const chosenBox = targetBox || imageAIBoxes[0];
    if (!chosenBox) return;

    let photosToAttach: AttachedPhotoItem[] = [];
    if (specificPhoto) {
      const url = specificPhoto.stored_url
        ? (specificPhoto.stored_url.startsWith('http') ? specificPhoto.stored_url : `http://localhost:8085${specificPhoto.stored_url}`)
        : specificPhoto.source_url;
      photosToAttach = [{ url, photoIndex: specificPhoto.index, name: `Photo #${specificPhoto.index}` }];
    }
    // No specific photo: open a clean new chat with nothing pre-selected

    setStudioStartWithNewChat(true);
    setStudioInitialImages(photosToAttach);
    setSelectedImageAIBoxModal(chosenBox);
  };

  // Differentiate text/copy generation AI boxes from image enhancement AI boxes (only showing connected nodes)
  const contentAIBoxes = workflowConfig.aiBoxes.filter(
    (b) => isContentConnectedAIBox(b, workflowConfig.connections)
  );
  const imageAIBoxes = workflowConfig.aiBoxes.filter(
    (b) => isImageConnectedAIBox(b, workflowConfig.connections)
  );

  // Native beforeunload reload/cancel alert when there is unsaved import data or active processing
  useEffect(() => {
    const hasUnsavedData = Boolean(
      isProcessing ||
      caption.trim() ||
      images.length > 0 ||
      source ||
      (logs.length > 0 && currentStepIndex >= 0)
    );

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedData) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isProcessing, caption, images.length, source, logs.length, currentStepIndex]);

  // Persist session to localStorage so navigating across pages or reloading preserves all information
  useEffect(() => {
    const hasData = Boolean(
      url.trim() ||
      caption.trim() ||
      images.length > 0 ||
      source ||
      (logs.length > 0 && currentStepIndex >= 0) ||
      aiGeneratedCopy.trim() ||
      Object.keys(aiGeneratedOutputs).length > 0 ||
      Object.keys(enhancedPhotos).length > 0
    );

    if (hasData) {
      try {
        const sessionData: FacebookImportSessionState = {
          url,
          source,
          caption,
          languages,
          images,
          propertyData,
          currentStepIndex,
          logs,
          pipelineError,
          pipelineErrorCode,
          browserState,
          aiGeneratedOutputs,
          aiGeneratedCopy,
          activeAIBoxId,
          selectedFormatId,
          manualMode,
          autoImport,
          preferredMethod,
          enhancedPhotos,
        };
        localStorage.setItem(FB_IMPORT_SESSION_KEY, JSON.stringify(sessionData));
      } catch (err) {
        console.warn('Failed to save Facebook import session:', err);
      }
    }
  }, [
    url,
    source,
    caption,
    languages,
    images,
    propertyData,
    currentStepIndex,
    logs,
    pipelineError,
    pipelineErrorCode,
    browserState,
    aiGeneratedOutputs,
    aiGeneratedCopy,
    activeAIBoxId,
    selectedFormatId,
    manualMode,
    autoImport,
    preferredMethod,
    enhancedPhotos,
  ]);

  // Load saved prompt templates from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('estate_prompt_templates');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPromptTemplates(parsed);
          const firstActive = parsed.find((p: any) => p.active) || parsed[0];
          if (firstActive) setSelectedTemplateId(String(firstActive.id));
          return;
        }
      }
    } catch {}
    setPromptTemplates(DEFAULT_PROMPT_TEMPLATES);
    setSelectedTemplateId(String(DEFAULT_PROMPT_TEMPLATES[0].id));
  }, []);

  const handleGenerateDynamicBoxCopy = async (boxId: string) => {
    if (!caption.trim()) {
      addLog('Cannot generate AI copy: caption is empty', 'warn');
      return;
    }

    const box = workflowConfig.aiBoxes.find((b) => b.id === boxId);
    if (!box) return;

    setAiBoxGenerating((prev) => ({ ...prev, [boxId]: true }));
    setAiError(null);
    const providerName = `${box.provider === 'runware_ai' ? 'Runware AI' : box.provider === 'laozhang_ai' ? 'LaoZhang AI' : box.provider === 'openai' ? 'OpenAI' : 'Google AI'} (${getAIModelDisplayName(box.provider, box.model)})`;
    addLog(`Calling ${providerName} for [${box.title}]...`, 'info');

    try {
      const resp = await fetch('http://localhost:8085/api/facebook-import/generate-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: box.provider,
          model: box.model,
          template_id: box.templateId || '',
          template_name: box.title,
          template_text: box.templateText || '',
          raw_content: caption,
          custom_prompt: box.customPrompt || '',
        }),
      });

      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || `Failed to generate listing copy with ${providerName}`);
      }

      setAiGeneratedOutputs((prev) => ({ ...prev, [boxId]: data.generated_content }));
      setAiGeneratedCopy(data.generated_content);
      setGeneratedProvider(box.provider);
      addLog(`✨ [${box.title}] generated copy successfully!`, 'success');
    } catch (err: any) {
      const msg = err.message || `Error communicating with ${providerName}`;
      setAiError(msg);
      addLog(`[${box.title}] AI generation failed: ${msg}`, 'error');
    } finally {
      setAiBoxGenerating((prev) => ({ ...prev, [boxId]: false }));
    }
  };

  const handleGenerateAllDynamicBoxes = async () => {
    if (!caption.trim()) {
      addLog('Cannot generate AI copies: caption is empty', 'warn');
      return;
    }

    const activeContentBoxes = contentAIBoxes.filter((b) => b.enabled);
    if (activeContentBoxes.length === 0) {
      addLog('No active text copy AI process boxes in workflow', 'warn');
      return;
    }

    setIsGeneratingAI(true);
    addLog(`🚀 Generating ${activeContentBoxes.length} dynamic AI copy processes simultaneously...`, 'info');

    try {
      await Promise.all(activeContentBoxes.map((b) => handleGenerateDynamicBoxCopy(b.id)));
      addLog(`🎉 All ${activeContentBoxes.length} dynamic AI copy processes completed!`, 'success');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Image Enhancement: single photo enhancement using active or specified image AI box
  const handleEnhanceSinglePhoto = async (img: ExtractedImage, targetBox?: DynamicAIBoxConfig) => {
    const chosenBox = targetBox || imageAIBoxes.find((b) => b.enabled) || imageAIBoxes[0];
    const provider = chosenBox?.provider || 'runware_ai';
    const model = chosenBox?.model || 'runware:101@1';
    const prompt =
      chosenBox?.customPrompt ||
      chosenBox?.templateText ||
      'Ultra-high clarity architectural photography, 8k resolution, perfectly balanced HDR interior lighting, luxury real estate editorial staging';
    const strength = chosenBox?.strength ?? 0.65;

    const rawUrl = img.stored_url
      ? (img.stored_url.startsWith('http') ? img.stored_url : `http://localhost:8085${img.stored_url}`)
      : img.source_url;

    setEnhancingPhotos((prev) => ({ ...prev, [img.index]: true }));
    addLog(`🎨 AI Enhancing Photo #${img.index} using ${getAIModelDisplayName(provider, model)}...`, 'info');

    try {
      const res = await fetch('http://localhost:8085/api/facebook-import/enhance-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: rawUrl,
          provider,
          model,
          prompt_name: chosenBox?.title || 'AI Image Enhancement',
          prompt_instructions: prompt,
          strength,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.status !== 'success' || !data.enhanced_url) {
        throw new Error(data.message || 'Image enhancement failed');
      }

      setEnhancedPhotos((prev) => ({ ...prev, [img.index]: data.enhanced_url }));
      addLog(`✨ Photo #${img.index} enhanced successfully!`, 'success');
    } catch (err: any) {
      console.error('Enhance failed:', err);
      addLog(`Failed to enhance Photo #${img.index}: ${err.message}`, 'error');
    } finally {
      setEnhancingPhotos((prev) => ({ ...prev, [img.index]: false }));
    }
  };

  // Image Enhancement: batch enhancement for all extracted photos
  const handleEnhanceAllPhotos = async () => {
    if (images.length === 0 || isEnhancingAllPhotos) return;
    setIsEnhancingAllPhotos(true);
    addLog(`🚀 Starting AI enhancement for all ${images.length} photos...`, 'info');
    try {
      for (const img of images) {
        await handleEnhanceSinglePhoto(img);
      }
      addLog(`🎉 All ${images.length} photos enhanced successfully!`, 'success');
    } finally {
      setIsEnhancingAllPhotos(false);
    }
  };

  // Revert an enhanced photo back to the original image
  const handleRevertPhotoToOriginal = (imgIndex: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEnhancedPhotos((prev) => {
      const next = { ...prev };
      delete next[imgIndex];
      return next;
    });
    setLightboxShowOriginal(false);
    addLog(`↩ Photo #${imgIndex} restored to original photo`, 'info');
  };

  const handleGenerateAICopy = async () => {
    if (!caption.trim()) {
      addLog('Cannot generate AI copy: caption is empty', 'warn');
      return;
    }

    const template = promptTemplates.find((t) => String(t.id) === String(selectedTemplateId));
    setIsGeneratingAI(true);
    setAiError(null);
    const providerName =
      aiProvider === 'runware_ai'
        ? 'Runware AI'
        : aiProvider === 'laozhang_ai'
        ? 'LaoZhang AI'
        : aiProvider === 'openai'
        ? 'OpenAI'
        : 'Google AI (Gemini)';
    addLog(`Calling ${providerName} with template "${template?.name || 'Selected'}"...`, 'info');

    try {
      const resp = await fetch('http://localhost:8085/api/facebook-import/generate-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: aiProvider,
          template_id: template ? String(template.id) : '',
          template_name: template?.name || 'Facebook Template',
          template_text: template?.templateText || '',
          raw_content: caption,
          custom_prompt: customPromptTweak,
        }),
      });

      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || `Failed to generate listing copy with ${providerName}`);
      }

      setAiGeneratedCopy(data.generated_content);
      setGeneratedProvider(aiProvider);
      addLog(`✨ ${providerName} generated listing copy successfully!`, 'success');
    } catch (err: any) {
      const msg = err.message || `Error communicating with ${providerName}`;
      setAiError(msg);
      addLog(`AI generation failed: ${msg}`, 'error');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleCopyAiCopy = () => {
    if (!aiGeneratedCopy) return;
    navigator.clipboard.writeText(aiGeneratedCopy);
    setCopiedAiCopy(true);
    setTimeout(() => setCopiedAiCopy(false), 2000);
  };

  // Live Browser Preview
  const [liveScreenshot, setLiveScreenshot] = useState<string | null>(null);
  const livePreviewInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const startLivePreview = () => {
    setLiveScreenshot(null);
    if (livePreviewInterval.current) clearInterval(livePreviewInterval.current);
    livePreviewInterval.current = setInterval(async () => {
      try {
        const res = await fetch('http://localhost:9223/live-screenshot');
        if (res.ok) {
          const data = await res.json();
          if (data.screenshot) setLiveScreenshot(data.screenshot);
        }
      } catch { /* browser worker may not be ready yet */ }
    }, 1500);
  };

  const stopLivePreview = () => {
    if (livePreviewInterval.current) {
      clearInterval(livePreviewInterval.current);
      livePreviewInterval.current = null;
    }
  };

  useEffect(() => () => stopLivePreview(), []);

  // Check initial browser status
  useEffect(() => {
    checkBrowserStatus();
    const interval = setInterval(checkBrowserStatus, 6000);
    return () => clearInterval(interval);
  }, []);

  const checkBrowserStatus = async () => {
    try {
      const resp = await fetch('http://localhost:8085/api/facebook-import/browser/status');
      if (resp.ok) {
        const data = await resp.json();
        if (data.session_state === 'LOGIN_REQUIRED') {
          setBrowserState('Facebook Login Required');
        } else if (data.session_state === 'CONNECTED') {
          setBrowserState('Logged In');
        } else if (data.worker_running) {
          setBrowserState('Browser Ready');
        } else {
          setBrowserState('Disconnected');
        }
      }
    } catch {
      setBrowserState('Disconnected');
    }
  };

  const addLog = (message: string, level: 'info' | 'warn' | 'error' | 'success' = 'info') => {
    const timeStr = new Date().toLocaleTimeString('en-GB');
    setLogs((prev) => [...prev, { timestamp: timeStr, message, level }]);
  };

  const handleStartImport = async () => {
    if (!url.trim()) return;

    setIsProcessing(true);
    setPipelineError(null);
    setShowPipelineModal(true);
    startLivePreview();
    setPipelineErrorCode(null);
    setManualMode(false);
    setSavedSuccessMsg(false);
    setLogs([]);
    setCaption('');
    setImages([]);
    setSource(null);
    setAiGeneratedOutputs({});
    setAiGeneratedCopy('');
    setPropertyData({
      project_name: '',
      listing_type: 'RENT',
      price: '',
      currency: 'THB',
      bedrooms: '',
      bathrooms: '',
      size_sqm: '',
      floor: '',
      building: '',
      unit_number: '',
      furnished: '',
      nearest_transit: '',
      location: '',
      move_in_status: '',
      contact_name: '',
      contact_phone: '',
      contact_line: '',
    });
    setCurrentStepIndex(0);
    addLog(`URL received: ${url.trim()}`);

    try {
      // Step 1: URL Normalization & Resolution
      setCurrentStepIndex(1);
      addLog('Resolving Facebook share URL...');
      const resResp = await fetch('http://localhost:8085/api/facebook-import/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!resResp.ok) {
        const resErr = await resResp.json();
        throw new Error(resErr.error_message || 'Invalid Facebook URL');
      }

      const resData = await resResp.json();
      addLog(`Facebook URL resolved to: ${resData.canonical_url}`, 'success');
      addLog(`Source detected: ${resData.source_name || resData.source_type}`);

      // Step 2 & 3: Opening Facebook Browser / Calling Meta Graph API
      setCurrentStepIndex(2);
      addLog('Connecting extraction pipeline...');

      const extractResp = await fetch('http://localhost:8085/api/facebook-import/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          preferred_method: preferredMethod,
          max_images: 50,
        }),
      });

      const extractData = await extractResp.json();

      if (!extractResp.ok || !extractData.success) {
        const job = extractData.job;
        const errCode = job?.error_code || 'EXTRACTION_FAILED';
        const errMsg = job?.error_message || extractData.error || 'Failed to extract Facebook post';

        setPipelineErrorCode(errCode);
        setPipelineError(errMsg);
        addLog(`Extraction interrupted: [${errCode}] ${errMsg}`, 'error');

        if (errCode === 'LOGIN_REQUIRED') {
          setBrowserState('Facebook Login Required');
        } else if (errCode === 'ACCESS_RESTRICTED') {
          setBrowserState('Access Restricted');
        }

        setIsProcessing(false);
        return;
      }

      // Step 4: Post Found
      setCurrentStepIndex(3);
      addLog('Target post container isolated & confirmed', 'success');

      const result = extractData.result;
      setSource(result.source);

      // Step 5: Caption Extracted
      setCurrentStepIndex(4);
      if (workflowConfig.getContent.enabled) {
        setCaption(result.caption.original || '');
        setLanguages(result.caption.language_detected || []);
        addLog(`Post caption extracted (${result.caption.original?.length || 0} characters)`, 'success');
      } else {
        setCaption('');
        setLanguages([]);
        addLog('Post caption extraction bypassed (disabled in Workflow Setup)', 'info');
      }

      // Step 6: Photos Detected
      if (workflowConfig.getImages.enabled) {
        setCurrentStepIndex(5);
        const photoList: ExtractedImage[] = result.images || [];
        addLog(`${photoList.length} photos detected in post container`);

        // Step 7: Verifying Photos
        setCurrentStepIndex(6);
        const verifiedCount = photoList.filter((img) => img.status !== 'rejected').length;
        addLog(`Verifying ${photoList.length} photos against target post context...`);

        // Step 8: Downloading Media
        setCurrentStepIndex(7);
        setImages(photoList);
        const downloadedCount = photoList.filter((img) => img.status === 'downloaded').length;
        addLog(`${verifiedCount} target-verified photos downloaded & stored locally`, 'success');
      } else {
        setImages([]);
        addLog('Image downloading bypassed (disabled in Workflow Setup)', 'info');
      }

      // Step 9: AI Analysis
      setCurrentStepIndex(8);
      addLog('AI analyzing property attributes & Thai/Myanmar/English context...');

      if (result.property) {
        setPropertyData({
          project_name: result.property.project_name || '',
          listing_type: result.property.listing_type || 'RENT',
          price: result.property.price ? String(result.property.price) : '',
          currency: result.property.currency || 'THB',
          bedrooms: result.property.bedrooms !== null && result.property.bedrooms !== undefined ? String(result.property.bedrooms) : '',
          bathrooms: result.property.bathrooms !== null && result.property.bathrooms !== undefined ? String(result.property.bathrooms) : '',
          size_sqm: result.property.size_sqm ? String(result.property.size_sqm) : '',
          floor: result.property.floor || '',
          building: result.property.building || '',
          unit_number: result.property.unit_number || '',
          furnished: result.property.furnished || '',
          nearest_transit: result.property.nearest_transit || '',
          location: result.property.location || '',
          move_in_status: result.property.move_in_status || '',
          contact_name: result.contact?.name || '',
          contact_phone: result.contact?.phone || '',
          contact_line: result.contact?.line || '',
        });
      }

      // Step 10: Complete
      setCurrentStepIndex(9);
      addLog('AI analysis complete. Import ready for review!', 'success');
      setBrowserState('Complete');
    } catch (err: any) {
      setPipelineError(err.message || 'An error occurred during extraction');
      addLog(`Failed: ${err.message}`, 'error');
    } finally {
      setIsProcessing(false);
      stopLivePreview();
    }
  };

  const handleCopyCaption = () => {
    if (!caption) return;
    navigator.clipboard.writeText(caption);
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 2000);
  };

  const handleCopyImage = async (
    target: { index: number; url: string },
    e?: React.MouseEvent
  ) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }

    const { index, url } = target;

    if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
      addLog('Clipboard image copying is not supported on this browser or connection.', 'error');
      return;
    }

    // Function to produce a true image/png Blob
    const producePngBlob = async (): Promise<Blob> => {
      // 1. Try instant extraction from loaded DOM image
      const domImg = document.getElementById(`imported-fb-photo-${index}`) as HTMLImageElement | null;
      if (domImg && domImg.complete && domImg.naturalWidth > 0) {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = domImg.naturalWidth;
          canvas.height = domImg.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(domImg, 0, 0);
            const directPng = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
            if (directPng && directPng.size > 0) {
              return directPng;
            }
          }
        } catch (taintErr) {
          console.warn('DOM canvas tainted or blocked, falling back to direct fetch:', taintErr);
        }
      }

      // 2. Fetch via local storage or backend CORS proxy
      let fetchUrl = url;
      if (url.startsWith('/storage') || url.startsWith('/')) {
        fetchUrl = `http://localhost:8085${url}`;
      } else if (!url.startsWith('http://localhost:8085')) {
        fetchUrl = `http://localhost:8085/api/facebook-import/proxy-image?url=${encodeURIComponent(url)}`;
      }

      const res = await fetch(fetchUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rawBlob = await res.blob();

      // If already image/png, return directly
      if (rawBlob.type === 'image/png') {
        return rawBlob;
      }

      // 3. Convert to image/png via createImageBitmap or Image element
      if (typeof createImageBitmap === 'function') {
        try {
          const bmp = await createImageBitmap(rawBlob);
          const canvas = document.createElement('canvas');
          canvas.width = bmp.width;
          canvas.height = bmp.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(bmp, 0, 0);
            const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
            if (png) return png;
          }
        } catch (bmpErr) {
          console.warn('createImageBitmap failed, using HTMLImageElement:', bmpErr);
        }
      }

      // Fallback conversion using HTMLImageElement
      return new Promise<Blob>((resolve, reject) => {
        const objUrl = URL.createObjectURL(rawBlob);
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(objUrl);
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas 2D context not available'));
            return;
          }
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((png) => {
            if (png) resolve(png);
            else reject(new Error('Failed to convert image to PNG'));
          }, 'image/png');
        };
        img.onerror = () => {
          URL.revokeObjectURL(objUrl);
          reject(new Error('Failed to decode image'));
        };
        img.src = objUrl;
      });
    };

    const pngPromise = producePngBlob();

    try {
      // Primary: synchronous invocation with Promise<Blob> inside user gesture window (Safari & Chrome 97+)
      const item = new ClipboardItem({
        'image/png': pngPromise as any,
      });

      await navigator.clipboard.write([item]);
      setCopiedImageIndex(index);
      setTimeout(() => setCopiedImageIndex(null), 2000);
      addLog(`Image #${String(index).padStart(2, '0')} copied to clipboard! (Ready to paste image)`, 'success');
    } catch (primaryErr: any) {
      console.warn('Primary Promise<ClipboardItem> failed, trying resolved blob fallback:', primaryErr);
      try {
        const resolvedBlob = await pngPromise;
        const item = new ClipboardItem({
          'image/png': resolvedBlob,
        });
        await navigator.clipboard.write([item]);
        setCopiedImageIndex(index);
        setTimeout(() => setCopiedImageIndex(null), 2000);
        addLog(`Image #${String(index).padStart(2, '0')} copied to clipboard! (Ready to paste image)`, 'success');
      } catch (fallbackErr: any) {
        console.error('Failed to copy image to clipboard:', fallbackErr);
        addLog(`Failed to copy image #${index}: ${fallbackErr.message || 'Clipboard permission error'}`, 'error');
      }
    }
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
      a.download = `property-photo-${index !== undefined ? index : Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      addLog(`Image #${index !== undefined ? index : ''} downloaded successfully`, 'success');
    } catch (err: any) {
      console.warn('Direct blob download failed, falling back to window download:', err);
      const fullUrl = imgUrl.startsWith('/storage') ? `http://localhost:8085${imgUrl}` : imgUrl;
      const a = document.createElement('a');
      a.href = fullUrl;
      a.target = '_blank';
      a.download = `property-photo-${index !== undefined ? index : Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const handleDownloadAllImages = async () => {
    if (!images || images.length === 0 || isDownloadingAll) return;
    setIsDownloadingAll(true);
    setDownloadProgress(0);
    addLog(`Preparing to download all ${images.length} photos...`, 'info');

    try {
      const zip = new JSZip();

      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const rawUrl = enhancedPhotos[img.index] || (img.stored_url
          ? (img.stored_url.startsWith('http') ? img.stored_url : `http://localhost:8085${img.stored_url}`)
          : img.source_url);

        try {
          const resp = await fetch(rawUrl, { mode: 'cors' });
          const blob = await resp.blob();
          const ext = blob.type.includes('png') ? 'png' : 'jpg';
          const padIndex = String(img.index !== undefined ? img.index : i + 1).padStart(2, '0');
          const isEnh = Boolean(enhancedPhotos[img.index]);
          zip.file(`photo-${padIndex}${isEnh ? '-enhanced' : ''}.${ext}`, blob);
        } catch (fetchErr) {
          console.warn(`Failed to package photo #${img.index || i + 1}:`, fetchErr);
        }
        setDownloadProgress(i + 1);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const blobUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `property-photos-${images.length}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);

      addLog(`All ${images.length} photos packaged & downloaded successfully as ZIP archive`, 'success');
    } catch (err: any) {
      console.error('ZIP packaging failed, falling back to sequential download:', err);
      addLog('ZIP creation failed, downloading photos individually...', 'warn');
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const fullUrl = enhancedPhotos[img.index] || (img.stored_url
          ? (img.stored_url.startsWith('http') ? img.stored_url : `http://localhost:8085${img.stored_url}`)
          : img.source_url);
        await handleDownloadImage(fullUrl, img.index);
        setDownloadProgress(i + 1);
        await new Promise((res) => setTimeout(res, 250));
      }
      addLog(`All ${images.length} photos downloaded individually`, 'success');
    } finally {
      setIsDownloadingAll(false);
      setDownloadProgress(0);
    }
  };

  // Scroll isolation & smooth wheel zoom for studio image lightbox
  useScrollLock(previewImageIndex !== null, {
    onWheel: (e) => {
      // Zoom with wheel/trackpad without any bleed or scroll to container underneath
      if (e.deltaY < 0) {
        setZoomScale((s) => Math.min(s + 0.15, 3));
      } else if (e.deltaY > 0) {
        setZoomScale((s) => Math.max(s - 0.15, 0.5));
      }
    },
  });

  // Keyboard navigation for studio image lightbox
  useEffect(() => {
    if (previewImageIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewImageIndex(null);
      } else if (e.key === 'ArrowLeft') {
        setPreviewImageIndex((prev) => {
          if (prev === null || images.length <= 1) return prev;
          setZoomScale(1);
          return (prev - 1 + images.length) % images.length;
        });
      } else if (e.key === 'ArrowRight') {
        setPreviewImageIndex((prev) => {
          if (prev === null || images.length <= 1) return prev;
          setZoomScale(1);
          return (prev + 1) % images.length;
        });
      } else if (e.key === '+' || e.key === '=') {
        setZoomScale((s) => Math.min(s + 0.25, 3));
      } else if (e.key === '-') {
        setZoomScale((s) => Math.max(s - 0.25, 0.5));
      } else if (e.key === '0') {
        setZoomScale(1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [previewImageIndex, images.length]);

  const handleSaveToInbox = async () => {
    const rentNum = propertyData.listing_type === 'RENT' && propertyData.price ? parseFloat(propertyData.price) : undefined;
    const saleNum = propertyData.listing_type === 'SALE' && propertyData.price ? parseFloat(propertyData.price) : undefined;

    const originalImgUrls = images.map((img) => img.stored_url || img.source_url);
    const finalEnhancedUrls = images.map((img) => enhancedPhotos[img.index] || img.stored_url || img.source_url);

    const finalDescription = aiGeneratedCopy || caption;

    const payload: Partial<Property> = {
      projectName: propertyData.project_name || 'Bangkok Property',
      listingType: (propertyData.listing_type as any) || 'RENT',
      propertyType: 'CONDO',
      title: `${propertyData.project_name || 'Listing'} - ${propertyData.listing_type} (${propertyData.bedrooms ? propertyData.bedrooms + ' Bed' : 'Condo'})`,
      description: finalDescription,
      rentPrice: rentNum,
      salePrice: saleNum,
      bedrooms: propertyData.bedrooms ? parseInt(propertyData.bedrooms, 10) : undefined,
      bathrooms: propertyData.bathrooms ? parseInt(propertyData.bathrooms, 10) : undefined,
      sizeSqm: propertyData.size_sqm ? parseFloat(propertyData.size_sqm) : undefined,
      floor: propertyData.floor ? `${propertyData.floor}` : undefined,
      btsMrt: propertyData.nearest_transit,
      status: 'NEW',
      sourceUrl: source?.canonical_url || url,
      sourceAuthor: source?.source_name || 'Facebook Import',
      originalImages: originalImgUrls,
      enhancedImages: finalEnhancedUrls,
      finalImages: finalEnhancedUrls,
      contactInfo: [
        propertyData.contact_phone ? `Tel: ${propertyData.contact_phone}` : '',
        propertyData.contact_line ? `Line: ${propertyData.contact_line}` : '',
      ]
        .filter(Boolean)
        .join(' | '),
    };

    try {
      // Call backend save
      await fetch('http://localhost:8085/api/facebook-import/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          result: {
            source,
            property: {
              ...propertyData,
              price: propertyData.price ? parseFloat(propertyData.price) : null,
              bedrooms: propertyData.bedrooms ? parseInt(propertyData.bedrooms, 10) : null,
              bathrooms: propertyData.bathrooms ? parseInt(propertyData.bathrooms, 10) : null,
              size_sqm: propertyData.size_sqm ? parseFloat(propertyData.size_sqm) : null,
            },
            caption: { original: caption, ai_copy: aiGeneratedCopy, language_detected: languages },
            images: images.map((img) => ({
              ...img,
              stored_url: enhancedPhotos[img.index] || img.stored_url,
            })),
          },
        }),
      });

      if (onSaveToInbox) {
        onSaveToInbox(payload);
      }

      setSavedSuccessMsg(true);
      setTimeout(() => {
        if (onNavigateTab) {
          onNavigateTab('inbox');
        }
      }, 1200);
    } catch {
      if (onSaveToInbox) {
        onSaveToInbox(payload);
      }
      setSavedSuccessMsg(true);
    }
  };

  const handleManualPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < e.target.files.length; i++) {
      formData.append('photos', e.target.files[i]);
    }

    try {
      addLog('Uploading photos manually...', 'info');
      const resp = await fetch('http://localhost:8085/api/facebook-import/upload-photos', {
        method: 'POST',
        body: formData,
      });
      if (resp.ok) {
        const data = await resp.json();
        const uploadedImgs: ExtractedImage[] = data.images || [];
        setImages((prev) => [...prev, ...uploadedImgs]);
        addLog(`Uploaded ${uploadedImgs.length} photos successfully`, 'success');
      }
    } catch {
      addLog('Failed to upload photos', 'error');
    }
  };

  const handleRerunExtraction = () => {
    handleStartImport();
  };

  const hasDataToClear = Boolean(
    url.trim() ||
    caption.trim() ||
    images.length > 0 ||
    source ||
    logs.length > 0 ||
    aiGeneratedCopy ||
    Object.keys(aiGeneratedOutputs).length > 0 ||
    propertyData.project_name
  );

  const handleDeleteImport = () => {
    setUrl('');
    setSource(null);
    setCaption('');
    setLanguages([]);
    setImages([]);
    setCurrentStepIndex(-1);
    setPipelineError(null);
    setPipelineErrorCode(null);
    setBrowserState('Browser Ready');
    setIsProcessing(false);
    setLogs([]);
    setAiGeneratedOutputs({});
    setAiGeneratedCopy('');
    setEnhancedPhotos({});
    setEnhancingPhotos({});
    setIsEnhancingAllPhotos(false);
    setPropertyData({
      project_name: '',
      listing_type: 'RENT',
      price: '',
      currency: 'THB',
      bedrooms: '',
      bathrooms: '',
      size_sqm: '',
      floor: '',
      building: '',
      unit_number: '',
      furnished: '',
      nearest_transit: '',
      location: '',
      move_in_status: '',
      contact_name: '',
      contact_phone: '',
      contact_line: '',
    });
    setManualMode(false);
    setCopiedCaption(false);
    setCopiedImageIndex(null);
    setPreviewImageIndex(null);
    setShowPostContentModal(false);
    setShowRawJsonModal(false);
    setShowPipelineModal(false);
    try {
      localStorage.removeItem(FB_IMPORT_SESSION_KEY);
    } catch {}
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '3rem' }}>
      {/* Top Nav Bar Center Portal: Select Workflow Format */}
      {headerCenterEl &&
        createPortal(
          <div style={{ width: '280px', maxWidth: '100%', display: 'flex', alignItems: 'center' }}>
            <Select
              options={workflowFormats.map((f) => {
                const connectedCount = (f.config?.aiBoxes || []).filter((b: any) =>
                  isAIBoxConnected(b, f.config?.connections)
                ).length;
                return {
                  value: f.id,
                  label: `${f.name} (${connectedCount} AI Processes)`,
                };
              })}
              value={selectedFormatId}
              onChange={handleFormatChange}
              height="32px"
            />
          </div>,
          headerCenterEl
        )}

      {/* Top Nav Bar Portal Actions (Directly inside top navigation bar) */}
      {headerActionEl &&
        createPortal(
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexShrink: 0 }}>
            {/* Auto Import Toggle */}
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <span>Auto Import</span>
              <button
                type="button"
                role="switch"
                aria-checked={autoImport}
                onClick={() => setAutoImport(!autoImport)}
                title={autoImport ? 'Auto import is enabled' : 'Auto import is disabled'}
                style={{
                  width: '30px',
                  height: '16px',
                  backgroundColor: autoImport ? '#1877F2' : 'rgba(255, 255, 255, 0.15)',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'background-color 0.2s ease',
                  padding: 0,
                  outline: 'none',
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
                    left: autoImport ? '16px' : '2px',
                    transition: 'left 0.2s ease',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                  }}
                />
              </button>
            </label>


            {/* Open Canvas in Modal Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowWorkflowCanvasModal(true)}
              title="Open workflow canvas editor"
              leftIcon={<FiMaximize2 style={{ fontSize: '12px' }} />}
              style={{
                height: '30px',
                padding: '0 0.625rem',
                fontWeight: 500,
                fontSize: '0.75rem',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.375rem',
                whiteSpace: 'nowrap',
                borderRadius: '0.375rem',
              }}
            >
              Canvas
            </Button>

            {/* Compact Live Browser Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                try {
                  window.open('http://localhost:6080/vnc.html?autoconnect=true&resize=scale', 'OpenClawLiveBrowser', 'width=1200,height=850,left=150,top=100');
                } catch (e) {}
                setShowLiveBrowserModal(true);
              }}
              title="Open live browser automation stream"
              leftIcon={<FiMonitor style={{ fontSize: '13px' }} />}
              style={{
                height: '30px',
                padding: '0 0.625rem',
                fontWeight: 500,
                fontSize: '0.75rem',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.375rem',
                whiteSpace: 'nowrap',
                borderRadius: '0.375rem',
              }}
            >
              Live Browser
            </Button>

            {/* Clear All Data Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowClearConfirmModal(true)}
              disabled={!hasDataToClear}
              title={
                hasDataToClear
                  ? 'Clear all imported data and reset view'
                  : 'No data to clear'
              }
              leftIcon={<FiTrash2 style={{ fontSize: '12px' }} />}
              style={{
                height: '30px',
                padding: '0 0.625rem',
                fontWeight: 500,
                fontSize: '0.75rem',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.375rem',
                whiteSpace: 'nowrap',
                borderRadius: '0.375rem',
                color: hasDataToClear ? 'var(--status-danger, #EF4444)' : 'var(--text-muted)',
                borderColor: hasDataToClear ? 'rgba(239, 68, 68, 0.35)' : 'var(--border-color)',
                backgroundColor: hasDataToClear ? 'rgba(239, 68, 68, 0.06)' : 'transparent',
                opacity: hasDataToClear ? 1 : 0.45,
                cursor: hasDataToClear ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s ease',
              }}
            >
              Clear
            </Button>
          </div>,
          headerActionEl
        )}



      {/* ERROR / LOGIN REQUIRED BANNER */}
      {pipelineError && (
        <div
          style={{
            backgroundColor: pipelineErrorCode === 'LOGIN_REQUIRED' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            border: `1px solid ${pipelineErrorCode === 'LOGIN_REQUIRED' ? 'var(--status-warning)' : 'var(--status-danger)'}`,
            borderRadius: '0.75rem',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <FiAlertCircle
              style={{
                fontSize: '1.25rem',
                color: pipelineErrorCode === 'LOGIN_REQUIRED' ? 'var(--status-warning)' : 'var(--status-danger)',
              }}
            />
            <div style={{ flex: 1 }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                {pipelineErrorCode === 'LOGIN_REQUIRED'
                  ? 'Facebook Login Required'
                  : pipelineErrorCode === 'ACCESS_RESTRICTED'
                  ? 'Facebook Access Restricted'
                  : 'Extraction Failed'}
              </h4>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
                {pipelineError}
              </p>
            </div>
            {pipelineErrorCode === 'LOGIN_REQUIRED' && (
              <Button variant="primary" size="sm" onClick={() => setShowLiveBrowserModal(true)}>
                Open Facebook Login
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setManualMode(true)}>
              Manual Fallback
            </Button>
          </div>
        </div>
      )}

      {/* SAVED TO INBOX NOTIFICATION */}
      {savedSuccessMsg && (
        <div
          style={{
            backgroundColor: 'rgba(34, 197, 94, 0.15)',
            border: '1px solid var(--status-success)',
            borderRadius: '0.75rem',
            padding: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <FiCheck style={{ color: 'var(--status-success)', fontSize: '1.25rem' }} />
          <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
            Property successfully saved to Property Inbox! Redirecting...
          </span>
        </div>
      )}

      {/* MANUAL FALLBACK MODE */}
      {manualMode && (
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px dashed var(--border-color)',
            borderRadius: '0.75rem',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Manual Fallback Import
            </h4>
            <Button variant="ghost" size="sm" onClick={() => setManualMode(false)}>
              Exit Manual Mode
            </Button>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
            Automatic extraction couldn't access this post. You can paste the visible caption and upload photos directly.
          </p>
          <div>
            <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Paste Caption Manually:
            </label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={5}
              placeholder="Paste caption here..."
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '0.375rem',
                padding: '0.625rem',
                fontSize: '0.8125rem',
                marginTop: '0.375rem',
                fontFamily: 'inherit',
              }}
            />
          </div>
          <div>
            <input
              type="file"
              multiple
              accept="image/*"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleManualPhotoUpload}
            />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <FiUploadCloud style={{ marginRight: '0.375rem' }} /> Upload Photos Directly
            </Button>
          </div>
        </div>
      )}

      {/* MODAL: 2-COLUMN EXTRACTION MONITOR (PIPELINE STATUS & LIVE ACTIVITY LOG) */}
      <Modal
        isOpen={showPipelineModal}
        onClose={() => setShowPipelineModal(false)}
        closeOnOverlayClick={true}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <FiActivity style={{ color: 'var(--accent-primary)', fontSize: '1.125rem' }} />
            <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Pipeline Status & Activity Log
            </span>
          </div>
        }
        maxWidth="960px"
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '1rem',
            alignItems: 'stretch',
          }}
        >
          {/* LEFT COLUMN: VERTICAL PIPELINE STATUS (COLUMN DESIGN, NO GLOW, NOT BOLD) */}
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '0.75rem',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                  Pipeline Status
                </span>
                {currentStepIndex >= 0 && (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 400,
                      color: isProcessing ? 'var(--accent-primary)' : 'var(--status-success)',
                    }}
                  >
                    ({currentStepIndex + 1}/{PIPELINE_STEPS.length}: {PIPELINE_STEPS[currentStepIndex]?.label})
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>Browser:</span>
                <Badge
                  variant={
                    browserState === 'Logged In' || browserState === 'Complete'
                      ? 'success'
                      : browserState === 'Facebook Login Required' || browserState === 'Access Restricted'
                      ? 'warning'
                      : 'default'
                  }
                  size="sm"
                >
                  {browserState}
                </Badge>
              </div>
            </div>

            {/* Vertical Stepper Column */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                paddingLeft: '0.25rem',
                paddingTop: '0.25rem',
              }}
            >
              {PIPELINE_STEPS.map((step, idx) => {
                const isCompleted = currentStepIndex > idx;
                const isCurrent = currentStepIndex === idx && isProcessing;
                const isFailed = currentStepIndex === idx && pipelineError !== null;

                return (
                  <div
                    key={step.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      position: 'relative',
                    }}
                  >
                    {/* Vertical connecting line */}
                    {idx < PIPELINE_STEPS.length - 1 && (
                      <div
                        style={{
                          position: 'absolute',
                          left: '11px',
                          top: '22px',
                          bottom: '-12px',
                          width: '2px',
                          backgroundColor: isCompleted ? '#22C55E' : 'var(--border-color)',
                          zIndex: 0,
                        }}
                      />
                    )}

                    {/* Step Node Circle (no glow, flat clean) */}
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isCompleted
                          ? '#22C55E'
                          : isCurrent
                          ? '#3B82F6'
                          : isFailed
                          ? '#EF4444'
                          : 'var(--bg-main)',
                        border: `1px solid ${
                          isCompleted
                            ? '#22C55E'
                            : isCurrent
                            ? '#3B82F6'
                            : isFailed
                            ? '#EF4444'
                            : 'var(--border-color)'
                        }`,
                        color: isCompleted || isCurrent || isFailed ? '#FFFFFF' : 'var(--text-muted)',
                        fontSize: '0.6875rem',
                        fontWeight: 400,
                        zIndex: 1,
                        flexShrink: 0,
                      }}
                    >
                      {isCompleted ? (
                        <FiCheck style={{ fontSize: '12px', strokeWidth: 2.5 }} />
                      ) : isCurrent ? (
                        <FiRefreshCw className="spin" style={{ fontSize: '11px', display: 'inline-block' }} />
                      ) : isFailed ? (
                        <FiAlertCircle style={{ fontSize: '11px' }} />
                      ) : (
                        <span>{idx + 1}</span>
                      )}
                    </div>

                    {/* Step Label (regular weight, no bold) */}
                    <span
                      style={{
                        fontSize: '0.8125rem',
                        fontWeight: 400,
                        color: isCompleted
                          ? 'var(--text-primary)'
                          : isCurrent
                          ? '#60A5FA'
                          : isFailed
                          ? '#F87171'
                          : 'var(--text-muted)',
                      }}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT COLUMN: LIVE ACTIVITY LOG CONSOLE */}
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '0.75rem',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                Activity Log
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                {logs.length} events
              </span>
            </div>

            <div
              style={{
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                borderRadius: '0.5rem',
                padding: '0.875rem 1rem',
                flex: 1,
                minHeight: '260px',
                maxHeight: '440px',
                overflowY: 'auto',
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.375rem',
              }}
            >
              {logs.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: '1rem 0', fontWeight: 400 }}>
                  Waiting for Facebook import to start...
                </div>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '0.5rem', lineHeight: '1.4' }}>
                    <span style={{ color: 'var(--text-muted)', flexShrink: 0, fontWeight: 400 }}>{log.timestamp}</span>
                    <span
                      style={{
                        color:
                          log.level === 'success'
                            ? 'var(--status-success)'
                            : log.level === 'error'
                            ? 'var(--status-danger)'
                            : log.level === 'warn'
                            ? 'var(--status-warning)'
                            : 'var(--text-primary)',
                        fontWeight: 400,
                      }}
                    >
                      {log.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* LIVE BROWSER PREVIEW PANEL */}
      {isProcessing && liveScreenshot && (
        <div
          style={{
            backgroundColor: '#0A0A0A',
            border: '1px solid var(--accent-primary)',
            borderRadius: '0.75rem',
            overflow: 'hidden',
            boxShadow: '0 0 24px rgba(59,130,246,0.15)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.5rem 0.875rem',
              backgroundColor: 'rgba(59,130,246,0.1)',
              borderBottom: '1px solid rgba(59,130,246,0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: '#22C55E',
                  display: 'inline-block',
                  boxShadow: '0 0 6px #22C55E',
                  animation: 'pulse 1.5s infinite',
                }}
              />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-primary)' }}>
                🔴 Live Browser Preview
              </span>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                — OpenClaw automation running
              </span>
            </div>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>updates every 1.5s</span>
          </div>
          <div style={{ position: 'relative', lineHeight: 0 }}>
            <img
              src={liveScreenshot}
              alt="Live browser preview"
              style={{
                width: '100%',
                display: 'block',
                maxHeight: '420px',
                objectFit: 'contain',
                backgroundColor: '#000',
              }}
            />
            {/* Step overlay badge */}
            <div
              style={{
                position: 'absolute',
                bottom: '0.5rem',
                left: '0.5rem',
                backgroundColor: 'rgba(0,0,0,0.75)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(59,130,246,0.4)',
                borderRadius: '0.375rem',
                padding: '0.25rem 0.625rem',
                fontSize: '0.6875rem',
                fontWeight: 600,
                color: 'var(--accent-primary)',
              }}
            >
              {currentStepIndex >= 0 && currentStepIndex < PIPELINE_STEPS.length
                ? `Step ${currentStepIndex + 1}/${PIPELINE_STEPS.length}: ${PIPELINE_STEPS[currentStepIndex].label}`
                : 'Initializing'}
            </div>
          </div>
        </div>
      )}

      {/* 2-COLUMN WORKSPACE: LEFT (URL INPUT + CONTENT + AI) / RIGHT (PHOTOS) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: '1.25rem',
          alignItems: 'start',
        }}
      >
        {/* ==================== LEFT COLUMN ==================== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* URL INPUT & ACTION BUTTONS ROW (NO OUTER CONTAINER) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              width: '100%',
            }}
          >
            {/* Integrated Input Container */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                borderRadius: '0.375rem',
                padding: '0 0.75rem',
                height: '36px',
                minWidth: 0,
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
              }}
            >
              <FaFacebook style={{ color: '#1877F2', fontSize: '1rem', flexShrink: 0, marginRight: '0.5rem' }} />
              <input
                type="text"
                placeholder="Paste Facebook post URL (e.g. https://www.facebook.com/share/p/...)"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && url.trim() && !isProcessing) {
                    handleStartImport();
                  }
                }}
                disabled={isProcessing}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '0.8125rem',
                  minWidth: 0,
                }}
              />
              {url && !isProcessing && (
                <button
                  type="button"
                  onClick={() => setUrl('')}
                  title="Clear input"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    marginRight: '0.375rem',
                  }}
                >
                  <FiX style={{ fontSize: '13px' }} />
                </button>
              )}
              <kbd
                style={{
                  fontSize: '0.6875rem',
                  padding: '2px 5px',
                  borderRadius: '3px',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-muted)',
                  lineHeight: 1,
                  fontFamily: 'monospace',
                  userSelect: 'none',
                }}
              >
                ↵ Enter
              </kbd>
            </div>

            {/* Primary Import Button (Icon Only) */}
            <Button
              variant="primary"
              onClick={handleStartImport}
              disabled={!url.trim() || isProcessing}
              title={isProcessing ? 'Importing Facebook post...' : 'Import Post'}
              aria-label="Import Post"
              style={{
                width: '36px',
                height: '36px',
                padding: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#1877F2',
                borderColor: '#1877F2',
                borderRadius: '0.375rem',
                flexShrink: 0,
              }}
            >
              {isProcessing ? (
                <FiRefreshCw className="spin" style={{ animation: 'spin 1s linear infinite', fontSize: '15px' }} />
              ) : (
                <FiDownload style={{ fontSize: '15px' }} />
              )}
            </Button>

            {/* View Post Content & Raw Data Modal Button (Icon Only) */}
            <Button
              variant="outline"
              onClick={() => setShowPostContentModal(true)}
              disabled={!caption && !source}
              title={
                caption || source
                  ? 'View Post Content & Raw Data'
                  : 'Post Content (Import a post first)'
              }
              aria-label="View Post Content & Raw Data"
              style={{
                width: '36px',
                height: '36px',
                padding: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '0.375rem',
                flexShrink: 0,
                backgroundColor: caption || source ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-main)',
                border: caption || source ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid var(--border-color)',
                opacity: !caption && !source ? 0.45 : 1,
                cursor: !caption && !source ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <FiFileText
                style={{
                  fontSize: '15px',
                  color: caption || source ? '#3B82F6' : 'var(--text-muted)',
                }}
              />
            </Button>

            {/* Pipeline & Activity Log Modal Button (Icon Only) */}
            <Button
              variant="outline"
              onClick={() => setShowPipelineModal(true)}
              title={
                currentStepIndex >= 0
                  ? `Pipeline Status & Activity Log (${currentStepIndex + 1}/${PIPELINE_STEPS.length})`
                  : 'Pipeline Status & Activity Log'
              }
              aria-label="Pipeline & Activity Log"
              style={{
                width: '36px',
                height: '36px',
                padding: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '0.375rem',
                flexShrink: 0,
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
              }}
            >
              {isProcessing ? (
                <FiRefreshCw className="spin" style={{ animation: 'spin 1s linear infinite', fontSize: '15px', color: '#3B82F6' }} />
              ) : (
                <FiActivity style={{ fontSize: '15px', color: currentStepIndex >= 0 ? '#22C55E' : 'var(--text-muted)' }} />
              )}
            </Button>
          </div>

          {/* MOTHER BOX 2: AI COPY GENERATOR PANEL */}
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '0.75rem',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                AI Copy Generator
              </h3>
              <button
                type="button"
                onClick={handleGenerateAllDynamicBoxes}
                disabled={isGeneratingAI || !caption.trim()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  height: '32px',
                  padding: '0 0.75rem',
                  borderRadius: '8px',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                  color: 'var(--text-secondary)',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  cursor: isGeneratingAI || !caption.trim() ? 'not-allowed' : 'pointer',
                  opacity: isGeneratingAI || !caption.trim() ? 0.6 : 1,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                  boxShadow: 'none',
                }}
                onMouseEnter={(e) => {
                  if (!isGeneratingAI && caption.trim()) {
                    e.currentTarget.style.borderColor = 'var(--accent-primary)';
                    e.currentTarget.style.color = 'var(--accent-primary)';
                    e.currentTarget.style.backgroundColor = isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(37, 99, 235, 0.06)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                  e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)';
                }}
              >
                {isGeneratingAI ? (
                  <FiRefreshCw className="spin" style={{ animation: 'spin 1s linear infinite', fontSize: '12px' }} />
                ) : (
                  <FiCpu style={{ fontSize: '12px' }} />
                )}
                Generate All ({contentAIBoxes.filter((b) => b.enabled).length})
              </button>
            </div>

            {/* AI Process Card Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, 272px)',
                gap: '0.875rem',
              }}
            >
              {contentAIBoxes.length === 0 ? (
                <div
                  style={{
                    gridColumn: '1 / -1',
                    padding: '1.25rem',
                    color: 'var(--text-secondary)',
                    fontSize: '0.8125rem',
                    backgroundColor: isDark ? '#161B22' : 'var(--bg-main)',
                    border: isDark ? '1px dashed rgba(255, 255, 255, 0.12)' : '1px dashed var(--border-color)',
                    borderRadius: '12px',
                    textAlign: 'center',
                  }}
                >
                  No text copy generators configured. Image enhancement AI models are active under Imported Photos.
                </div>
              ) : (
                contentAIBoxes.map((box) => {
                  const isGoogle = box.provider === 'google_ai';
                  const isActive = activeAIBoxId === box.id;
                  const hasGenerated = Boolean(aiGeneratedOutputs[box.id]);
                  const isBoxLoading = Boolean(aiBoxGenerating[box.id]);

                  return (
                    <div
                      key={box.id}
                      onClick={() => {
                        setActiveAIBoxId(box.id);
                        if (aiGeneratedOutputs[box.id]) setAiGeneratedCopy(aiGeneratedOutputs[box.id]);
                      }}
                      style={{
                        width: '272px',
                        backgroundColor: isDark ? '#161B22' : 'var(--bg-main)',
                        border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid var(--border-color)',
                        borderRadius: '12px',
                        padding: '1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.875rem',
                        cursor: 'pointer',
                        boxShadow: 'none',
                        transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                      }}
                    >
                      {/* Card Header: Icon + Title + Status */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                          {box.provider === 'runware_ai'
                            ? <RunwareIcon size={16} color="#10B981" />
                            : box.provider === 'laozhang_ai'
                            ? <LaoZhangIcon size={16} />
                            : isGoogle
                            ? <SiGooglegemini style={{ fontSize: '16px', color: '#3B82F6', flexShrink: 0 }} />
                            : <OpenAIIcon size={16} color="#10B981" />
                          }
                          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {box.title}
                          </span>
                        </div>

                        {hasGenerated && !isBoxLoading && (
                          <span style={{
                            fontSize: '0.6875rem',
                            fontWeight: 500,
                            color: '#10B981',
                            backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.08)',
                            padding: '2px 7px',
                            borderRadius: '10px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            flexShrink: 0,
                          }}>
                            <FiCheck style={{ fontSize: '11px' }} /> Ready
                          </span>
                        )}
                      </div>

                      {/* Model badge line */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{
                          fontSize: '0.6875rem',
                          fontWeight: 500,
                          color: isDark ? '#A1A1AA' : '#52525B',
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                          border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.06)',
                          borderRadius: '6px',
                          padding: '2px 7px',
                        }}>
                          {getAIModelDisplayName(box.provider, box.model)}
                        </span>
                        {hasGenerated && (
                          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                            · {aiGeneratedOutputs[box.id]?.length || 0} chars
                          </span>
                        )}
                      </div>

                      {/* Generate / Regenerate & Actions */}
                      {hasGenerated ? (
                        <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center', width: '100%', marginTop: 'auto' }}>
                          {/* Regenerate button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveAIBoxId(box.id);
                              handleGenerateDynamicBoxCopy(box.id);
                            }}
                            disabled={isBoxLoading || !caption.trim()}
                            style={{
                              flex: 1,
                              height: '36px',
                              backgroundColor: 'var(--accent-primary)',
                              border: '1px solid var(--accent-primary)',
                              borderRadius: '8px',
                              color: '#FFFFFF',
                              fontSize: '0.8125rem',
                              fontWeight: 500,
                              cursor: isBoxLoading || !caption.trim() ? 'not-allowed' : 'pointer',
                              opacity: isBoxLoading || !caption.trim() ? 0.6 : 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              transition: 'all 0.15s ease',
                              boxShadow: 'none',
                            }}
                            onMouseEnter={(e) => {
                              if (!isBoxLoading && caption.trim()) {
                                e.currentTarget.style.backgroundColor = 'var(--accent-hover)';
                                e.currentTarget.style.borderColor = 'var(--accent-hover)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--accent-primary)';
                              e.currentTarget.style.borderColor = 'var(--accent-primary)';
                            }}
                          >
                            <FiRefreshCw
                              className={isBoxLoading ? 'spin' : ''}
                              style={{ animation: isBoxLoading ? 'spin 1s linear infinite' : 'none', fontSize: '12px' }}
                            />
                            <span>{isBoxLoading ? 'Regenerating...' : 'Regenerate'}</span>
                          </button>

                          {/* Copy button: Icon only */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const copyText = aiGeneratedOutputs[box.id];
                              if (!copyText) return;
                              navigator.clipboard.writeText(copyText);
                              setCopiedBoxId(box.id);
                              setTimeout(() => setCopiedBoxId(null), 2000);
                            }}
                            title={copiedBoxId === box.id ? 'Copied!' : 'Copy AI Copy'}
                            style={{
                              width: '36px',
                              height: '36px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '8px',
                              border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                              backgroundColor: copiedBoxId === box.id
                                ? (isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)')
                                : (isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)'),
                              color: copiedBoxId === box.id ? '#10B981' : 'var(--text-secondary)',
                              cursor: 'pointer',
                              flexShrink: 0,
                              transition: 'all 0.15s ease',
                              boxShadow: 'none',
                            }}
                            onMouseEnter={(e) => {
                              if (copiedBoxId !== box.id) {
                                e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (copiedBoxId !== box.id) {
                                e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)';
                              }
                            }}
                          >
                            {copiedBoxId === box.id ? <FiCheck style={{ fontSize: '13px' }} /> : <FiCopy style={{ fontSize: '13px' }} />}
                          </button>

                          {/* Result button: Icon only */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveAIBoxId(box.id);
                              if (aiGeneratedOutputs[box.id]) {
                                setAiGeneratedCopy(aiGeneratedOutputs[box.id]);
                              }
                              setViewingResultBox(box);
                            }}
                            title="View Result"
                            style={{
                              width: '36px',
                              height: '36px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '8px',
                              border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
                              color: 'var(--text-primary)',
                              cursor: 'pointer',
                              flexShrink: 0,
                              transition: 'all 0.15s ease',
                              boxShadow: 'none',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)';
                            }}
                          >
                            <FiFileText style={{ fontSize: '13px' }} />
                          </button>
                        </div>
                      ) : (
                        /* Generate button: Theme accent color */
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveAIBoxId(box.id);
                            handleGenerateDynamicBoxCopy(box.id);
                          }}
                          disabled={isBoxLoading || !caption.trim()}
                          style={{
                            height: '36px',
                            width: '100%',
                            backgroundColor: 'var(--accent-primary)',
                            border: '1px solid var(--accent-primary)',
                            borderRadius: '8px',
                            color: '#FFFFFF',
                            fontSize: '0.8125rem',
                            fontWeight: 500,
                            cursor: isBoxLoading || !caption.trim() ? 'not-allowed' : 'pointer',
                            opacity: isBoxLoading || !caption.trim() ? 0.6 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            marginTop: 'auto',
                            transition: 'all 0.15s ease',
                            boxShadow: 'none',
                          }}
                          onMouseEnter={(e) => {
                            if (!isBoxLoading && caption.trim()) {
                              e.currentTarget.style.backgroundColor = 'var(--accent-hover)';
                              e.currentTarget.style.borderColor = 'var(--accent-hover)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--accent-primary)';
                            e.currentTarget.style.borderColor = 'var(--accent-primary)';
                          }}
                        >
                          {isBoxLoading
                            ? <FiRefreshCw className="spin" style={{ animation: 'spin 1s linear infinite', fontSize: '13px' }} />
                            : <FiZap style={{ fontSize: '13px' }} />
                          }
                          <span>{isBoxLoading ? 'Generating...' : 'Generate'}</span>
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Error */}
            {aiError && (
              <div
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid var(--status-error)',
                  borderRadius: '0.375rem',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.75rem',
                  color: '#F87171',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>{aiError}</span>
                <button
                  type="button"
                  onClick={() => setAiError(null)}
                  style={{ background: 'transparent', border: 'none', color: '#F87171', cursor: 'pointer', fontSize: '1rem' }}
                >×</button>
              </div>
            )}
          </div>
        </div>

        {/* ==================== RIGHT COLUMN ==================== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', height: 'fit-content' }}>
          {/* MOTHER BOX 3: IMPORTED PHOTOS PANEL */}
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '0.75rem',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              boxShadow: 'var(--shadow-sm)',
              height: 'fit-content',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'nowrap' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                Imported Photos ({images.length})
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'nowrap', flexShrink: 0 }}>
                {imageAIBoxes.length > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleOpenImageStudio(imageAIBoxes[0])}
                    leftIcon={<RunwareIcon size={12} color="var(--text-secondary)" />}
                    title="Open Image Studio"
                    style={{
                      height: '34px',
                      padding: '0 0.875rem',
                      fontSize: '0.8125rem',
                      fontWeight: 500,
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-main)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      boxShadow: 'var(--shadow-sm)',
                      whiteSpace: 'nowrap',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      cursor: 'pointer',
                    }}
                  >
                    Studio
                  </Button>
                )}
                {imageAIBoxes.length > 0 && images.length > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleEnhanceAllPhotos}
                    disabled={isEnhancingAllPhotos}
                    leftIcon={
                      isEnhancingAllPhotos ? (
                        <FiRefreshCw className="animate-spin" style={{ fontSize: '12px' }} />
                      ) : (
                        <HiSparkles style={{ fontSize: '13px', color: '#F59E0B' }} />
                      )
                    }
                    style={{
                      height: '34px',
                      padding: '0 0.875rem',
                      fontSize: '0.8125rem',
                      fontWeight: 500,
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-main)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      boxShadow: 'var(--shadow-sm)',
                      whiteSpace: 'nowrap',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      cursor: isEnhancingAllPhotos ? 'not-allowed' : 'pointer',
                    }}
                    title="Enhance all photos using AI model"
                  >
                    {isEnhancingAllPhotos
                      ? `Enhancing ${Object.keys(enhancedPhotos).length}/${images.length}`
                      : 'Enhance All'}
                  </Button>
                )}
                {images.length > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleDownloadAllImages}
                    disabled={isDownloadingAll}
                    leftIcon={
                      isDownloadingAll ? (
                        <FiRefreshCw className="animate-spin" style={{ fontSize: '12px' }} />
                      ) : (
                        <FiDownload style={{ fontSize: '12px' }} />
                      )
                    }
                    style={{
                      height: '34px',
                      padding: '0 0.875rem',
                      fontSize: '0.8125rem',
                      fontWeight: 500,
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-main)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      boxShadow: 'var(--shadow-sm)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      whiteSpace: 'nowrap',
                      cursor: isDownloadingAll ? 'not-allowed' : 'pointer',
                    }}
                    title="Download all photos as a ZIP package"
                  >
                    {isDownloadingAll ? `Downloading ${downloadProgress}/${images.length}` : 'Download'}
                  </Button>
                )}
              </div>
            </div>

            {images.length === 0 ? (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '2rem',
                  color: 'var(--text-muted)',
                  border: '1px dashed var(--border-color)',
                  borderRadius: '0.5rem',
                  minHeight: '260px',
                }}
              >
                <FiImage style={{ fontSize: '2rem', marginBottom: '0.5rem', opacity: 0.5 }} />
                <span>No photos imported</span>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  gap: '0.625rem',
                  alignContent: 'start',
                  alignItems: 'start',
                  gridAutoRows: 'max-content',
                  overflowY: 'auto',
                  paddingRight: '0.25rem',
                  maxHeight: 'calc(100vh - 140px)',
                }}
              >
                {images.map((img, idx) => {
                  const isEnhanced = Boolean(enhancedPhotos[img.index]);
                  const isEnhancing = Boolean(enhancingPhotos[img.index]);
                  const displayUrl = isEnhanced
                    ? enhancedPhotos[img.index]
                    : (img.stored_url ? `http://localhost:8085${img.stored_url}` : img.source_url);

                  return (
                    <div
                      key={img.index}
                      onMouseEnter={() => setHoveredPhotoIndex(img.index)}
                      onMouseLeave={() => setHoveredPhotoIndex(null)}
                      onClick={() => {
                        setPreviewImageIndex(idx);
                        setZoomScale(1);
                      }}
                      style={{
                        position: 'relative',
                        backgroundColor: '#000',
                        border: '1px solid var(--border-color)',
                        borderRadius: '0.5rem',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        aspectRatio: '4 / 3',
                        display: 'flex',
                      }}
                    >
                      <img
                        id={`imported-fb-photo-${img.index}`}
                        crossOrigin="anonymous"
                        src={displayUrl}
                        alt={`Photo ${img.index}`}
                        loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      {/* Circular index badge (e.g. 1 instead of #01) */}
                      <span
                        style={{
                          position: 'absolute',
                          top: '6px',
                          left: '6px',
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: 'rgba(0, 0, 0, 0.65)',
                          backdropFilter: 'blur(4px)',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          color: '#FFFFFF',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 2,
                        }}
                      >
                        {img.index}
                      </span>

                      {/* Enhanced badge */}
                      {isEnhanced && (
                        <span
                          style={{
                            position: 'absolute',
                            bottom: '6px',
                            left: '6px',
                            padding: '3px 7px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(0, 0, 0, 0.72)',
                            backdropFilter: 'blur(6px)',
                            border: '1px solid rgba(255, 255, 255, 0.16)',
                            color: '#FFFFFF',
                            fontSize: '0.625rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            zIndex: 2,
                            letterSpacing: '0.2px',
                          }}
                        >
                          <HiSparkles style={{ fontSize: '10px', color: '#FFFFFF' }} />
                          Enhanced
                        </span>
                      )}

                      {/* Enhancing overlay */}
                      {isEnhancing && (
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            backgroundColor: 'rgba(0, 0, 0, 0.72)',
                            backdropFilter: 'blur(2px)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            color: '#FFFFFF',
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            zIndex: 3,
                          }}
                        >
                          <FiRefreshCw className="animate-spin" style={{ fontSize: '18px' }} />
                          <span>Enhancing...</span>
                        </div>
                      )}

                      {/* Action buttons: Enhance + Copy + Download (smooth opacity animation on hover) */}
                      <div
                        style={{
                          position: 'absolute',
                          top: '6px',
                          right: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          zIndex: 2,
                          opacity: hoveredPhotoIndex === img.index || isEnhancing ? 1 : 0,
                          pointerEvents: hoveredPhotoIndex === img.index || isEnhancing ? 'auto' : 'none',
                          transition: hoveredPhotoIndex === img.index || isEnhancing
                            ? 'opacity 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)'
                            : 'opacity 0.2s ease-out',
                        }}
                      >
                        {/* Enhance Single Photo Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEnhanceSinglePhoto(img);
                          }}
                          disabled={isEnhancing}
                          title={isEnhanced ? 'Re-enhance photo' : 'Enhance photo'}
                          aria-label="Enhance photo"
                          style={{
                            width: '26px',
                            height: '26px',
                            backgroundColor: 'rgba(0, 0, 0, 0.65)',
                            backdropFilter: 'blur(4px)',
                            color: '#FFFFFF',
                            border: '1px solid rgba(255, 255, 255, 0.25)',
                            borderRadius: '50%',
                            padding: 0,
                            cursor: isEnhancing ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
                            transition: 'background-color 0.2s ease, border-color 0.2s ease, transform 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.45)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.65)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
                          }}
                        >
                          {isEnhancing ? (
                            <FiRefreshCw className="animate-spin" style={{ fontSize: '12px' }} />
                          ) : (
                            <HiSparkles style={{ fontSize: '12px', color: '#FFFFFF' }} />
                          )}
                        </button>

                        {/* Revert to Original Photo Button */}
                        {isEnhanced && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRevertPhotoToOriginal(img.index, e);
                            }}
                            title="Revert to original photo"
                            aria-label="Revert to original photo"
                            style={{
                              width: '26px',
                              height: '26px',
                              backgroundColor: 'rgba(0, 0, 0, 0.65)',
                              backdropFilter: 'blur(4px)',
                              color: '#FFFFFF',
                              border: '1px solid rgba(255, 255, 255, 0.25)',
                              borderRadius: '50%',
                              padding: 0,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
                              transition: 'background-color 0.2s ease, border-color 0.2s ease, transform 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.75)';
                              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.9)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.65)';
                              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
                            }}
                          >
                            <FiRotateCcw style={{ fontSize: '11px' }} />
                          </button>
                        )}

                        {/* Copy Image Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            handleCopyImage({ index: img.index, url: displayUrl }, e);
                          }}
                          title={copiedImageIndex === img.index ? 'Copied image to clipboard!' : 'Copy image'}
                          aria-label="Copy image"
                          style={{
                            width: '26px',
                            height: '26px',
                            backgroundColor: 'rgba(0, 0, 0, 0.65)',
                            backdropFilter: 'blur(4px)',
                            color: copiedImageIndex === img.index ? '#10B981' : '#FFFFFF',
                            border: copiedImageIndex === img.index ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid rgba(255, 255, 255, 0.25)',
                            borderRadius: '50%',
                            padding: 0,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
                            transition: 'background-color 0.2s ease, border-color 0.2s ease, transform 0.15s ease',
                          }}
                        >
                          {copiedImageIndex === img.index ? (
                            <FiCheck style={{ fontSize: '13px' }} />
                          ) : (
                            <FiCopy style={{ fontSize: '13px' }} />
                          )}
                        </button>

                        {/* Download Image Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            handleDownloadImage(displayUrl, img.index, e);
                          }}
                          title="Download image"
                          aria-label="Download image"
                          style={{
                            width: '26px',
                            height: '26px',
                            backgroundColor: 'rgba(0, 0, 0, 0.65)',
                            backdropFilter: 'blur(4px)',
                            color: '#FFFFFF',
                            border: '1px solid rgba(255, 255, 255, 0.25)',
                            borderRadius: '50%',
                            padding: 0,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
                            transition: 'background-color 0.2s ease, border-color 0.2s ease, transform 0.15s ease',
                          }}
                        >
                          <FiDownload style={{ fontSize: '13px' }} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>



      {/* CLEAR ALL DATA CONFIRMATION MODAL */}
      <Modal
        isOpen={showClearConfirmModal}
        onClose={() => setShowClearConfirmModal(false)}
        closeOnOverlayClick={true}
        maxWidth="440px"
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', color: '#EF4444' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <FiAlertTriangle style={{ fontSize: '16px', color: '#EF4444' }} />
            </div>
            <span style={{ fontSize: '1rem', fontWeight: 600 }}>Clear All Data</span>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Are you sure you want to clear all imported data?
            </p>
            <div
              style={{
                marginTop: '0.75rem',
                padding: '0.75rem',
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '0.375rem',
                fontSize: '0.75rem',
                color: '#F87171',
                lineHeight: 1.6,
              }}
            >
              ⚠️ This will reset the URL input, extracted caption, all {images.length > 0 ? `${images.length} imported photos` : 'photos'}, generated AI copy, and activity logs.
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: '0.625rem',
              paddingTop: '0.875rem',
              borderTop: '1px solid var(--border-color)',
            }}
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowClearConfirmModal(false)}
              style={{ height: '36px', minWidth: '80px', fontSize: '0.8125rem' }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<FiTrash2 />}
              onClick={() => {
                handleDeleteImport();
                setShowClearConfirmModal(false);
              }}
              style={{
                height: '36px',
                backgroundColor: '#EF4444',
                borderColor: '#DC2626',
                color: '#FFFFFF',
                fontWeight: 600,
                fontSize: '0.8125rem',
                padding: '0 1rem',
              }}
            >
              Yes, Clear All
            </Button>
          </div>
        </div>
      </Modal>

      {/* POST CONTENT & RAW EXTRACTED DATA MODAL */}
      <Modal
        isOpen={showPostContentModal}
        onClose={() => setShowPostContentModal(false)}
        closeOnOverlayClick={true}
        maxWidth="760px"
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <FiFileText style={{ color: 'var(--accent-primary)', fontSize: '1.25rem' }} />
            <span style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Post Content & Raw Data
            </span>
            {source?.extraction_method && (
              <Badge variant="info" size="sm">
                {source.extraction_method}
              </Badge>
            )}
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Source Meta Metadata */}
          <div
            style={{
              backgroundColor: 'var(--bg-main)',
              border: '1px solid var(--border-color)',
              borderRadius: '0.5rem',
              padding: '0.875rem',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.625rem',
              fontSize: '0.8125rem',
            }}
          >
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Source:</span>{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{source?.source_type || 'Facebook Post'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Author:</span>{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{source?.source_name || 'N/A'}</strong>
            </div>
            <div style={{ gridColumn: 'span 2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <span style={{ color: 'var(--text-muted)' }}>Canonical:</span>{' '}
              <a
                href={source?.canonical_url || url}
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}
              >
                {source?.canonical_url || url} <FiExternalLink style={{ fontSize: '0.6875rem' }} />
              </a>
            </div>
            {languages.length > 0 && (
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ color: 'var(--text-muted)' }}>Languages:</span>{' '}
                <span style={{ color: 'var(--text-secondary)' }}>{languages.join(', ')}</span>
              </div>
            )}
          </div>

          {/* Original Raw Facebook Caption Box */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Visible Caption (Raw Extracted Data)
              </label>
              <button
                type="button"
                onClick={handleCopyCaption}
style={{
                  height: '36px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0 1rem',
                  borderRadius: '8px',
                  background: 'transparent',
                  border: '1px solid var(--border-color)',
                  color: copiedCaption ? 'var(--status-success)' : 'var(--text-primary)',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                }}
              >
                {copiedCaption ? <FiCheck /> : <FiCopy />}
                <span>{copiedCaption ? 'Copied!' : 'Copy Caption'}</span>
              </button>
            </div>

            <div
              style={{
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                borderRadius: '0.5rem',
                padding: '0.875rem',
                fontSize: '0.8125rem',
                color: 'var(--text-primary)',
                whiteSpace: 'pre-wrap',
                maxHeight: '280px',
                overflowY: 'auto',
                lineHeight: 1.6,
              }}
            >
              {caption || <span style={{ color: 'var(--text-muted)' }}>No caption extracted</span>}
            </div>
          </div>

          {/* Action Buttons for Raw Data */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.25rem' }}>
            <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
              <Button
                variant="outline"
                size="md"
                onClick={() => setShowRawJsonModal(true)}
                leftIcon={<FiCode style={{ fontSize: '15px' }} />}
                style={{
                  height: '36px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  whiteSpace: 'nowrap',
                  padding: '0 1rem',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  borderRadius: '8px',
                }}
              >
                View Raw JSON
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={handleRerunExtraction}
                leftIcon={<FiRefreshCw style={{ fontSize: '15px' }} />}
                style={{
                  height: '36px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  whiteSpace: 'nowrap',
                  padding: '0 1rem',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  borderRadius: '8px',
                }}
              >
                Re-run Extraction
              </Button>
            </div>
            <Button variant="outline" size="md" onClick={() => setShowPostContentModal(false)} style={{
              height: '36px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              whiteSpace: 'nowrap',
              padding: '0 1rem',
              fontSize: '0.8125rem',
              fontWeight: 500,
              borderRadius: '8px',
                }}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* RAW JSON MODAL */}
      <Modal
        isOpen={showRawJsonModal}
        onClose={() => setShowRawJsonModal(false)}
        title="Raw Extraction JSON Data"
        zIndex={100010}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <pre
            style={{
              backgroundColor: 'var(--bg-main)',
              border: '1px solid var(--border-color)',
              borderRadius: '0.5rem',
              padding: '0.75rem',
              fontSize: '0.75rem',
              color: 'var(--text-primary)',
              overflowX: 'auto',
              maxHeight: '450px',
            }}
          >
            {JSON.stringify(
              {
                source,
                property: propertyData,
                caption: { original: caption, languages },
                images,
              },
              null,
              2
            )}
          </pre>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="outline" size="md" onClick={() => setShowRawJsonModal(false)} style={{
              height: '36px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              whiteSpace: 'nowrap',
              padding: '0 1rem',
              fontSize: '0.8125rem',
              fontWeight: 500,
              borderRadius: '8px',
                }}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* WORKFLOW CANVAS MODAL IN FACEBOOK IMPORT */}
      <Modal
        isOpen={showWorkflowCanvasModal}
        onClose={() => setShowWorkflowCanvasModal(false)}
        maxWidth="1480px"
        height="90vh"
        bodyPadding="0"
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                backgroundColor: 'rgba(139, 92, 246, 0.15)',
                color: '#A78BFA',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
              }}
            >
              <FiGitBranch />
            </div>
            <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Workflow Format: {activeFormat.name}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <Badge variant={workflowConfig.getContent.enabled ? 'info' : 'default'} size="sm">
                Content: {workflowConfig.getContent.enabled ? 'ON' : 'OFF'}
              </Badge>
              <Badge variant={workflowConfig.getImages.enabled ? 'success' : 'default'} size="sm">
                Images: {workflowConfig.getImages.enabled ? 'ON' : 'OFF'}
              </Badge>
              <Badge variant="warning" size="sm">
                {(workflowConfig.aiBoxes || []).filter((b) => isAIBoxConnected(b, workflowConfig.connections)).length} AI Boxes
              </Badge>
            </div>
          </div>
        }
        headerExtra={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowWorkflowCanvasModal(false);
                if (onNavigateTab) onNavigateTab('create-workflow');
                else window.location.href = '/create-workflow';
              }}
              leftIcon={<FiSliders />}
              style={{ height: '32px', fontSize: '0.75rem' }}
            >
              Manage All Formats
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowWorkflowCanvasModal(false)}
              leftIcon={<FiCheck />}
              style={{ height: '32px', fontSize: '0.75rem' }}
            >
              Done
            </Button>
          </div>
        }
      >
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          <FacebookWorkflowCanvas
            initialConfig={workflowConfig}
            onConfigChange={(newCfg) => {
              setWorkflowConfig(newCfg);
              const updatedFmt: WorkflowFormat = { ...activeFormat, config: newCfg, updatedAt: Date.now() };
              setActiveFormat(updatedFmt);
              const updatedList = workflowFormats.map((f) => (f.id === activeFormat.id ? updatedFmt : f));
              setWorkflowFormats(updatedList);
              saveWorkflowFormatsList(updatedList);
            }}
          />
        </div>
      </Modal>

      {/* FULLSCREEN STUDIO IMAGE LIGHTBOX (Image 2 style) */}
      {previewImageIndex !== null && images[previewImageIndex] && (() => {
        const activeImg = images[previewImageIndex];
        const isEnhanced = Boolean(enhancedPhotos[activeImg.index]);
        const isEnhancing = Boolean(enhancingPhotos[activeImg.index]);
        const activeImgUrl = (isEnhanced && !lightboxShowOriginal)
          ? enhancedPhotos[activeImg.index]
          : (activeImg.stored_url
            ? (activeImg.stored_url.startsWith('http') ? activeImg.stored_url : `http://localhost:8085${activeImg.stored_url}`)
            : activeImg.source_url);

        return (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.88)',
              backdropFilter: 'blur(8px)',
              zIndex: 99999,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              userSelect: 'none',
              overscrollBehavior: 'contain',
              touchAction: 'none',
              animation: 'fadeIn 0.15s ease',
            }}
            onWheel={(e) => {
              e.stopPropagation();
            }}
            onClick={() => setPreviewImageIndex(null)}
          >
            {/* Top-Left: Image Counter & Enhancement Status */}
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
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#FFFFFF',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  backdropFilter: 'blur(4px)',
                  padding: '4px 12px',
                  borderRadius: '16px',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                }}
              >
                {previewImageIndex + 1} / {images.length}
              </span>

              {isEnhanced && (
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
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  {lightboxShowOriginal ? 'Original Photo' : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <HiSparkles style={{ fontSize: '11px', color: '#FFFFFF' }} />
                      Enhanced
                    </span>
                  )}
                </span>
              )}
            </div>

            {/* Top-Right: Close Button (Circle with X) */}
            <button
              type="button"
              onClick={() => setPreviewImageIndex(null)}
              aria-label="Close preview"
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
            {images.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setZoomScale(1);
                  setPreviewImageIndex((prev) => (prev! - 1 + images.length) % images.length);
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
            {images.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setZoomScale(1);
                  setPreviewImageIndex((prev) => (prev! + 1) % images.length);
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
                alt={`Photo ${activeImg.index}`}
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
              {/* Hint Text (from Image 2) */}
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

                {/* Compare / View Original Photo Toggle Button */}
                {isEnhanced && (
                  <button
                    type="button"
                    onClick={() => setLightboxShowOriginal((v) => !v)}
                    title={lightboxShowOriginal ? 'Show enhanced photo' : 'Compare: view original photo'}
                    aria-label="Toggle compare original"
                    style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '50%',
                      backgroundColor: lightboxShowOriginal ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
                      border: 'none',
                      color: lightboxShowOriginal ? '#FBBF24' : '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = lightboxShowOriginal ? 'rgba(255, 255, 255, 0.2)' : 'transparent';
                    }}
                  >
                    {lightboxShowOriginal ? (
                      <FiEyeOff style={{ fontSize: '15px' }} />
                    ) : (
                      <FiEye style={{ fontSize: '15px' }} />
                    )}
                  </button>
                )}

                {/* Revert / Restore Original Photo Button */}
                {isEnhanced && (
                  <button
                    type="button"
                    onClick={() => handleRevertPhotoToOriginal(activeImg.index)}
                    title="Revert to original photo"
                    aria-label="Revert to original photo"
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
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.25)';
                      e.currentTarget.style.color = '#F87171';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = '#FFFFFF';
                    }}
                  >
                    <FiRotateCcw style={{ fontSize: '14px' }} />
                  </button>
                )}

                {/* Quick Enhance Button */}
                <button
                  type="button"
                  onClick={() => handleEnhanceSinglePhoto(activeImg)}
                  disabled={isEnhancing}
                  title={isEnhanced ? 'Re-enhance photo' : 'Enhance photo'}
                  aria-label="Enhance photo"
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    border: 'none',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: isEnhancing ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.16)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                  }}
                >
                  {isEnhancing ? (
                    <FiRefreshCw className="animate-spin" style={{ fontSize: '13px', color: '#FFFFFF' }} />
                  ) : (
                    <HiSparkles style={{ fontSize: '14px', color: '#FFFFFF' }} />
                  )}
                </button>

                {/* Copy Image Button */}
                <button
                  type="button"
                  onClick={(e) => handleCopyImage({ index: activeImg.index, url: activeImgUrl }, e)}
                  title={copiedImageIndex === activeImg.index ? 'Copied image!' : 'Copy image to clipboard'}
                  aria-label="Copy image"
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    backgroundColor: copiedImageIndex === activeImg.index ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                    border: 'none',
                    color: copiedImageIndex === activeImg.index ? '#10B981' : '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (copiedImageIndex !== activeImg.index) {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (copiedImageIndex !== activeImg.index) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  {copiedImageIndex === activeImg.index ? (
                    <FiCheck style={{ fontSize: '15px' }} />
                  ) : (
                    <FiCopy style={{ fontSize: '15px' }} />
                  )}
                </button>

                {/* Download Image Button */}
                <button
                  type="button"
                  onClick={(e) => handleDownloadImage(activeImgUrl, activeImg.index, e)}
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
          </div>
        );
      })()}

      {/* AI IMAGE ENHANCEMENT STUDIO MODAL */}
      {selectedImageAIBoxModal && (
        <Modal
          isOpen={Boolean(selectedImageAIBoxModal)}
          onClose={() => {
            setSelectedImageAIBoxModal(null);
            setStudioStartWithNewChat(false);
            setStudioInitialImages([]);
          }}
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <HiSparkles style={{ fontSize: '1.25rem', color: '#10B981' }} />
              <span>Image Studio · {selectedImageAIBoxModal.title ? selectedImageAIBoxModal.title.replace(/\bAI\s+/gi, '') : 'Image Enhancer'}</span>
            </div>
          }
          maxWidth="1160px"
          height="88vh"
          bodyPadding="0"
        >
          <AIImageStudio
            box={selectedImageAIBoxModal}
            importedPhotos={images}
            enhancedPhotosMap={enhancedPhotos}
            startWithNewChat={studioStartWithNewChat}
            initialAttachedImages={studioInitialImages}
            availablePrompts={promptTemplates.map((p) => ({
              id: String(p.id),
              name: p.name,
              category: p.category,
              templateText: p.templateText,
              model: p.model,
            }))}
            onPhotoEnhanced={(photoIndex, enhancedUrl) => {
              setEnhancedPhotos((prev) => ({ ...prev, [photoIndex]: enhancedUrl }));
              addLog(`✨ Photo #${photoIndex} enhanced via Image Studio`, 'success');
            }}
            onUpdateBox={(id, updates) => {
              setWorkflowConfig((prev) => ({
                ...prev,
                aiBoxes: prev.aiBoxes.map((b) => (b.id === id ? { ...b, ...updates } : b)),
              }));
              setSelectedImageAIBoxModal((prev) => (prev ? { ...prev, ...updates } : null));
            }}
            onToggleBox={(id) => {
              setWorkflowConfig((prev) => ({
                ...prev,
                aiBoxes: prev.aiBoxes.map((b) => (b.id === id ? { ...b, enabled: !b.enabled } : b)),
              }));
            }}
            onClose={() => {
              setSelectedImageAIBoxModal(null);
              setStudioStartWithNewChat(false);
              setStudioInitialImages([]);
            }}
          />
        </Modal>
      )}

      {/* VIEW / EDIT AI RESULT MODAL */}
      {viewingResultBox && (
        <Modal
          isOpen={Boolean(viewingResultBox)}
          onClose={() => setViewingResultBox(null)}
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FiFileText style={{ color: viewingResultBox.provider === 'google_ai' ? '#60A5FA' : '#10B981' }} />
              <span>AI Result: {viewingResultBox.title}</span>
            </div>
          }
          maxWidth="700px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.625rem 0.75rem', backgroundColor: 'var(--bg-main)', borderRadius: '0.375rem', border: '1px solid var(--border-color)' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Engine & Model:</span>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                  {viewingResultBox.provider === 'runware_ai' ? 'Runware AI' : viewingResultBox.provider === 'laozhang_ai' ? 'LaoZhang AI' : viewingResultBox.provider === 'google_ai' ? 'Google Gemini' : 'OpenAI ChatGPT'} · {viewingResultBox.model}
                </div>
              </div>
              <Badge variant={viewingResultBox.provider === 'runware_ai' ? 'success' : viewingResultBox.provider === 'google_ai' ? 'info' : 'success'}>
                {getAIModelDisplayName(viewingResultBox.provider, viewingResultBox.model)}
              </Badge>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Generated Listing Copy
                </label>
                {aiGeneratedOutputs[viewingResultBox.id] && (
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                    {aiGeneratedOutputs[viewingResultBox.id].length} chars
                  </span>
                )}
              </div>
              <textarea
                value={aiGeneratedOutputs[viewingResultBox.id] || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setAiGeneratedOutputs((prev) => ({ ...prev, [viewingResultBox.id]: val }));
                  if (activeAIBoxId === viewingResultBox.id) {
                    setAiGeneratedCopy(val);
                  }
                }}
                placeholder="No listing copy generated yet..."
                style={{
                  width: '100%',
                  minHeight: '280px',
                  maxHeight: '450px',
                  backgroundColor: 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '0.5rem',
                  padding: '0.875rem',
                  fontSize: '0.8125rem',
                  color: 'var(--text-primary)',
                  lineHeight: 1.6,
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
              <Button
                variant="outline"
                size="sm"
                disabled={Boolean(aiBoxGenerating[viewingResultBox.id]) || !caption.trim()}
                onClick={() => handleGenerateDynamicBoxCopy(viewingResultBox.id)}
                leftIcon={
                  <FiRefreshCw
                    className={aiBoxGenerating[viewingResultBox.id] ? 'spin' : ''}
                    style={{ animation: aiBoxGenerating[viewingResultBox.id] ? 'spin 1s linear infinite' : 'none' }}
                  />
                }
              >
                {aiBoxGenerating[viewingResultBox.id] ? 'Regenerating...' : 'Regenerate'}
              </Button>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={copiedBoxId === viewingResultBox.id ? <FiCheck /> : <FiCopy />}
                  onClick={() => {
                    const copyText = aiGeneratedOutputs[viewingResultBox.id];
                    if (copyText) {
                      navigator.clipboard.writeText(copyText);
                      setCopiedBoxId(viewingResultBox.id);
                      setTimeout(() => setCopiedBoxId(null), 2000);
                    }
                  }}
                >
                  {copiedBoxId === viewingResultBox.id ? 'Copied!' : 'Copy Result'}
                </Button>
                <Button variant="primary" size="sm" onClick={() => setViewingResultBox(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* LIVE BROWSER STREAM / VNC MODAL */}
      <Modal
        isOpen={showLiveBrowserModal}
        onClose={() => setShowLiveBrowserModal(false)}
        title="OpenClaw Live Facebook Browser"
        maxWidth="960px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.5rem 0.75rem',
              backgroundColor: 'var(--bg-main)',
              borderRadius: '0.375rem',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Status:</span>
              <Badge
                variant={browserState === 'Logged In' ? 'success' : 'warning'}
                size="sm"
              >
                {browserState}
              </Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open('http://localhost:6080/vnc.html?autoconnect=true&resize=scale', '_blank')}
            >
              <FiExternalLink style={{ marginRight: '0.25rem' }} /> Open in New Tab
            </Button>
          </div>

          <div
            style={{
              height: '520px',
              backgroundColor: '#000',
              borderRadius: '0.5rem',
              overflow: 'hidden',
              border: '1px solid var(--border-color)',
            }}
          >
            <iframe
              src="http://localhost:6080/vnc.html?autoconnect=true&resize=scale"
              title="OpenClaw VNC Live Browser"
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Authenticate directly in the window above. EstateAutomate never sees or stores your password.
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setShowLiveBrowserModal(false);
                  checkBrowserStatus();
                  if (url) handleStartImport();
                }}
              >
                Continue Extraction
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowLiveBrowserModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
