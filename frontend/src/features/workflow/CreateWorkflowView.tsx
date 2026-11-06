import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import {
  FacebookWorkflowCanvas,
  DEFAULT_FB_WORKFLOW_CONFIG,
  DEFAULT_GOOGLE_SHEET_PROMPT,
  loadAvailablePromptTemplates,
  applyPersistedNodeEnabledToConfig,
  stripLargeBase64FromWorkflowConfig,
  generateUniqueListingCode,
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
  getPinnedWorkflowFormatId,
  setPinnedWorkflowFormatId,
  restoreDefaultWorkflowFormats,
  type WorkflowFormat,
} from './workflowFormats';
import { isWatermarkAIBox, isTextFormatAIBox, isTextAIBox, isN8NAIBox, isExternalBrowserAIBox, isChromeProfileAIBox, isChromeTabGroupAIBox, isGoogleSheetBox } from '../facebook-import/aiModelUtils';
import { runN8NWorkflow } from '../../services/n8nService';
import { createBatchImageQueue, startImageQueue, focusBrowserTabGroup, openBrowserProfile, fetchTabGroups, waitForBrowserTabsReady, startAutomation, stopAutomation, getAutomationStatus, fetchImageQueue } from '../browser-processing/browserAutomationService';
import { resolvePromptForBrowserNode, getPersistedPromptKey } from '../browser-processing/browserPromptUtils';
import { getPersistedReferenceImage, loadPersistedReferenceImageAsync } from '../browser-processing/referenceImageStorage';
import { extractCleanCondoNameFromAiText } from '../browser-processing/FBHeroSettingsSidebox';
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
  FiEdit2,
  FiEdit3,
  FiImage,
  FiUploadCloud,
  FiX,
} from 'react-icons/fi';
import { FaFacebook, FaTiktok } from 'react-icons/fa';
import { HiSparkles } from 'react-icons/hi2';
import { BsPinAngle, BsPinAngleFill } from 'react-icons/bs';
import { useTheme } from '../../context/ThemeContext';

export function injectListingCodeIntoPrompt(
  prompt: string,
  listingCode: string,
  useGeneratedCode: boolean = true
): string {
  if (!useGeneratedCode || !listingCode || !prompt) return prompt;

  let updatedPrompt = prompt;

  // 1. Replace explicit bracket/brace placeholders case-insensitively
  // e.g. [NEW RANDOM CODE], [RANDOM CODE], [CODE], [PROPERTY CODE], [LISTING CODE], [NEW CODE], [GENERATED CODE], etc.
  const placeholderRegex =
    /\[(?:NEW\s+)?(?:RANDOM\s+)?CODE\]|\[(?:NEW\s+)?(?:GENERATED\s+)?CODE\]|\[(?:LISTING|PROPERTY)\s*CODE\]|\[(?:LISTING\s*ID|REF|CODE_FORMAT)\]|\{(?:NEW\s+)?(?:RANDOM\s+)?CODE\}|\{(?:LISTING|PROPERTY)\s*CODE\}|\<(?:NEW\s+)?(?:RANDOM\s+)?CODE\>|\[(?:CODE|LISTING\s*CODE|LISTING\s*ID|PROPERTY\s*CODE|REF|CODE_FORMAT)\]|\{(?:CODE|LISTING\s*CODE|LISTING\s*ID|PROPERTY\s*CODE|REF|CODE_FORMAT)\}|<(?:CODE|LISTING\s*CODE|LISTING\s*ID|PROPERTY\s*CODE|REF|CODE_FORMAT)>/gi;
  updatedPrompt = updatedPrompt.replace(placeholderRegex, listingCode);

  // 2. Replace lines like "Property Code: [NEW RANDOM CODE]" or "Property Code: [N/A]" or "Code: N/A"
  updatedPrompt = updatedPrompt.replace(
    /((?:•\s*)?(?:Property\s*Code|Listing\s*Code|Unit\s*Code|Code|Ref|Listing\s*ID):\s*)(?:\[[^\]\r\n]*\]|N\/A|null|none|\.{3}|—|-)/gi,
    `$1${listingCode}`
  );

  // 3. Replace generator instructions like "Always include one newly generated property code."
  updatedPrompt = updatedPrompt.replace(
    /(?:Always\s+include\s+one\s+newly\s+generated\s+property\s+code\.?)/gi,
    `Always use the authorized property code "${listingCode}". Do not invent or generate a different code.`
  );

  // 4. If prompt mentions Property Code or Code, instruct the AI to strictly use the general code
  if (/(?:Property\s*Code|Listing\s*Code|Listing\s*ID|\bCode\b)/i.test(updatedPrompt)) {
    updatedPrompt = `${updatedPrompt}\n\n[Property Code Requirement: The authorized unique code for this listing is "${listingCode}". Whenever "Property Code" or "Code" is output, strictly use "${listingCode}". Do not generate or invent a different code.]`;
  }

  return updatedPrompt;
}

export function applyListingCodeToGeneratedText(
  text: string,
  listingCode: string,
  useGeneratedCode: boolean = true
): string {
  if (!useGeneratedCode || !listingCode || !text) return text;
  let res = text;

  // 1. Replace leftover bracket placeholders
  const placeholderRegex =
    /\[(?:NEW\s+)?(?:RANDOM\s+)?CODE\]|\[(?:NEW\s+)?(?:GENERATED\s+)?CODE\]|\[(?:LISTING|PROPERTY)\s*CODE\]|\[(?:LISTING\s*ID|REF|CODE_FORMAT)\]|\{(?:NEW\s+)?(?:RANDOM\s+)?CODE\}|\{(?:LISTING|PROPERTY)\s*CODE\}|\<(?:NEW\s+)?(?:RANDOM\s+)?CODE\>|\[(?:CODE|LISTING\s*CODE|LISTING\s*ID|PROPERTY\s*CODE|REF|CODE_FORMAT)\]|\{(?:CODE|LISTING\s*CODE|LISTING\s*ID|PROPERTY\s*CODE|REF|CODE_FORMAT)\}|<(?:CODE|LISTING\s*CODE|LISTING\s*ID|PROPERTY\s*CODE|REF|CODE_FORMAT)>/gi;
  res = res.replace(placeholderRegex, listingCode);

  // 2. If the AI generated "Property Code: XYZ" or "• Property Code: ABC", enforce the general code!
  const propertyCodeLineRegex = /((?:•\s*)?(?:Property\s*Code|Listing\s*Code|Unit\s*Code):\s*)([^\r\n]+)/gi;
  res = res.replace(propertyCodeLineRegex, (_, prefix) => {
    return `${prefix}${listingCode}`;
  });

  // 3. Leftover patterns like "Code: [N/A]"
  res = res.replace(/(?:Code|Listing\s*Code|Listing\s*ID|Ref):\s*\[?(?:N\/A|null|none|\.{3}|—|-)\]?/gi, `Code: ${listingCode}`);

  return res;
}

async function requestAIGeneration(payload: Record<string, any>, signal?: AbortSignal): Promise<string> {
  let resolvedModel = payload.model || 'gemini-flash-lite-latest';
  if (resolvedModel.includes('gemini-2.5') || resolvedModel.includes('gemini-2.0') || resolvedModel.includes('gemini-1.5')) {
    resolvedModel = 'gemini-flash-lite-latest';
  }
  const cleanPayload = { ...payload, model: resolvedModel };

  const endpoints = [
    'http://localhost:9224/generate-ai',
    '/api/facebook-import/generate-ai',
    'http://localhost:8085/api/facebook-import/generate-ai',
  ];

  for (const ep of endpoints) {
    try {
      const resp = await fetch(ep, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanPayload),
        signal,
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.success && data.generated_content && typeof data.generated_content === 'string') {
          return data.generated_content.trim();
        }
      }
    } catch {}
  }
  return '';
}

const getWorkflowRunStorageKey = (formatId?: string) => `ea_workflow_execution_data_${formatId || 'default'}`;

const getSavedWorkflowRunData = (formatId?: string) => {
  if (typeof window === 'undefined') return null;
  try {
    // 1. Check specified format ID
    if (formatId && formatId !== 'default') {
      const raw = localStorage.getItem(getWorkflowRunStorageKey(formatId));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    }
    // 2. Check active workflow format ID from storage
    try {
      const activeId = getActiveWorkflowFormatId();
      if (activeId && activeId !== formatId) {
        const raw = localStorage.getItem(getWorkflowRunStorageKey(activeId));
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') return parsed;
        }
      }
    } catch {}
    // 3. Check global active execution key
    const activeRaw = localStorage.getItem('ea_workflow_execution_data_active');
    if (activeRaw) {
      const parsed = JSON.parse(activeRaw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
    // 4. Check default format key
    const defRaw = localStorage.getItem(getWorkflowRunStorageKey('default'));
    if (defRaw) {
      const parsed = JSON.parse(defRaw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
    // 5. Scan any workflow execution data keys in localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('ea_workflow_execution_data_')) {
        const raw = localStorage.getItem(k);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (
              parsed &&
              typeof parsed === 'object' &&
              (parsed.extractedImages?.length > 0 ||
                (parsed.extractedContent && parsed.extractedContent.trim().length > 0) ||
                parsed.executionState ||
                (parsed.aiGeneratedOutputs && Object.keys(parsed.aiGeneratedOutputs).length > 0))
            ) {
              return parsed;
            }
          } catch {}
        }
      }
    }
  } catch {}
  return null;
};

const resolveCurrentFormatId = () => {
  try {
    const sp = new URLSearchParams(window.location.search);
    return sp.get('id') || sp.get('format') || getActiveWorkflowFormatId() || 'default';
  } catch {
    return 'default';
  }
};

export const CreateWorkflowView: React.FC = () => {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const canvasRef = useRef<FacebookWorkflowCanvasRef>(null);
  const [formats, setFormats] = useState<WorkflowFormat[]>(() => getSavedWorkflowFormats());
  const formatsRef = useRef<WorkflowFormat[]>(formats);
  formatsRef.current = formats;
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

    const applyPersistedEnabledToFormats = (list: WorkflowFormat[]): WorkflowFormat[] =>
      list.map((f) =>
        f && f.config ? { ...f, config: applyPersistedNodeEnabledToConfig(f.config) } : f
      );

    // Sync latest workflow formats from backend API
    const syncFromBackend = () => {
      fetch('/api/workflow/config')
        .then((res) => res.json())
        .then((data) => {
          if (data && Array.isArray(data.workflow_formats) && data.workflow_formats.length > 0) {
            // Check if local storage has newer updates that haven't synced yet
            try {
              const localRaw = localStorage.getItem('estate_saved_workflow_formats_v2');
              if (localRaw && data.timestamp) {
                const localParsed = JSON.parse(localRaw);
                const maxLocalUpdated = Array.isArray(localParsed)
                  ? Math.max(...localParsed.map((f: any) => f.updatedAt || 0), 0)
                  : 0;
                if (maxLocalUpdated > data.timestamp) {
                  // Local formats are newer, skip overwriting
                  return;
                }
              }
            } catch {}

            const syncedFormats = applyPersistedEnabledToFormats(data.workflow_formats);
            setFormats(syncedFormats);
            try {
              localStorage.setItem('estate_saved_workflow_formats_v2', JSON.stringify(syncedFormats));
            } catch {
              try {
                const compact = syncedFormats.map((f) =>
                  f.config ? { ...f, config: stripLargeBase64FromWorkflowConfig(f.config) } : f
                );
                localStorage.setItem('estate_saved_workflow_formats_v2', JSON.stringify(compact));
              } catch {}
            }
            setEditingFormat((prev) => {
              const sp = new URLSearchParams(window.location.search);
              const urlId = sp.get('id') || sp.get('format');
              const targetId = urlId || prev?.id;
              const found = syncedFormats.find((f: WorkflowFormat) => f.id === targetId);
              return found || prev || syncedFormats[0];
            });
          }
        })
        .catch(() => {});
    };

    syncFromBackend();

    const handleWfSync = () => {
      syncFromBackend();
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

  // Inline format renaming on dashboard cards
  const [inlineRenamingId, setInlineRenamingId] = useState<string | null>(null);
  const [inlineRenamingName, setInlineRenamingName] = useState<string>('');

  // Debounced auto-save timer for workflow format name editing
  const formatNameSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFormatNameChange = (newName: string) => {
    setModalFormatName(newName);
    if (!editingFormat) return;

    const updated: WorkflowFormat = {
      ...editingFormat,
      name: newName,
      updatedAt: Date.now(),
    };
    setEditingFormat(updated);
    setFormats((prevFormats) =>
      prevFormats.map((f) => (f.id === editingFormat.id ? updated : f))
    );

    if (formatNameSaveTimerRef.current) {
      clearTimeout(formatNameSaveTimerRef.current);
    }
    formatNameSaveTimerRef.current = setTimeout(() => {
      setFormats((latestFormats) => {
        saveWorkflowFormatsList(latestFormats);
        return latestFormats;
      });
    }, 400);
  };

  const handleFormatNameCommit = () => {
    if (formatNameSaveTimerRef.current) {
      clearTimeout(formatNameSaveTimerRef.current);
    }
    if (!editingFormat) return;
    const finalName = modalFormatName.trim() || editingFormat.name || 'Untitled Workflow Format';
    setModalFormatName(finalName);
    const updated: WorkflowFormat = {
      ...editingFormat,
      name: finalName,
      updatedAt: Date.now(),
    };
    setEditingFormat(updated);
    setFormats((prevFormats) => {
      const updatedList = prevFormats.map((f) => (f.id === editingFormat.id ? updated : f));
      saveWorkflowFormatsList(updatedList);
      return updatedList;
    });
  };

  const handleSaveInlineRename = (formatId: string) => {
    const trimmed = inlineRenamingName.trim();
    if (trimmed) {
      setFormats((prevFormats) => {
        const updatedList = prevFormats.map((f) =>
          f.id === formatId ? { ...f, name: trimmed, updatedAt: Date.now() } : f
        );
        saveWorkflowFormatsList(updatedList);
        return updatedList;
      });
      if (editingFormat?.id === formatId) {
        setEditingFormat((prev) => (prev ? { ...prev, name: trimmed, updatedAt: Date.now() } : null));
        setModalFormatName(trimmed);
      }
    }
    setInlineRenamingId(null);
  };

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
  const [runFacebookUrl, setRunFacebookUrl] = useState<string>(() => {
    const formatId = resolveCurrentFormatId();
    const saved = getSavedWorkflowRunData(formatId);
    if (saved?.runFacebookUrl) return saved.runFacebookUrl;
    try {
      const fbSession = localStorage.getItem('estate_facebook_import_session_v1');
      if (fbSession) {
        const parsed = JSON.parse(fbSession);
        if (parsed?.url) return parsed.url;
      }
    } catch {}
    return '';
  });

  // Workflow Live Execution States (Canvas execution runner)
  const [executionState, setExecutionState] = useState<WorkflowExecutionState | undefined>(() => {
    const formatId = resolveCurrentFormatId();
    const saved = getSavedWorkflowRunData(formatId);
    if (saved?.executionState) {
      return {
        ...saved.executionState,
        isRunning: false,
        activeNodeIds: [],
      };
    }
    return undefined;
  });
  const [extractedContent, setExtractedContent] = useState<string>(() => {
    const formatId = resolveCurrentFormatId();
    const saved = getSavedWorkflowRunData(formatId);
    if (saved?.extractedContent) return saved.extractedContent;
    try {
      const fbSession = localStorage.getItem('estate_facebook_import_session_v1');
      if (fbSession) {
        const parsed = JSON.parse(fbSession);
        if (parsed?.caption) return parsed.caption;
      }
    } catch {}
    return '';
  });
  const [extractedImages, setExtractedImages] = useState<
    Array<{
      index: number;
      facebook_photo_id?: string;
      source_url: string;
      stored_url?: string;
      filename?: string;
      width?: number;
      height?: number;
      status?: string;
    }>
  >(() => {
    const formatId = resolveCurrentFormatId();
    const saved = getSavedWorkflowRunData(formatId);
    if (Array.isArray(saved?.extractedImages) && saved.extractedImages.length > 0) {
      return saved.extractedImages;
    }
    try {
      const fbSession = localStorage.getItem('estate_facebook_import_session_v1');
      if (fbSession) {
        const parsed = JSON.parse(fbSession);
        if (Array.isArray(parsed?.images) && parsed.images.length > 0) {
          return parsed.images.map((img: any, idx: number) => ({
            index: typeof img.index === 'number' && img.index > 0 ? img.index : idx + 1,
            facebook_photo_id: img.facebook_photo_id || img.id || `photo-${idx + 1}`,
            source_url: img.source_url || img.url || '',
            stored_url: img.stored_url || img.url || '',
            filename: img.filename || `Photo #${idx + 1}`,
            width: img.width,
            height: img.height,
            status: 'verified',
          }));
        }
      }
    } catch {}
    return [];
  });
  const [watermarkedPhotos, setWatermarkedPhotos] = useState<Record<number, string>>(() => {
    const formatId = resolveCurrentFormatId();
    const saved = getSavedWorkflowRunData(formatId);
    if (saved?.watermarkedPhotos && Object.keys(saved.watermarkedPhotos).length > 0) {
      return saved.watermarkedPhotos;
    }
    try {
      const fbSession = localStorage.getItem('estate_facebook_import_session_v1');
      if (fbSession) {
        const parsed = JSON.parse(fbSession);
        if (parsed?.watermarkedPhotos) return parsed.watermarkedPhotos;
      }
    } catch {}
    return {};
  });
  const [enhancedPhotos, setEnhancedPhotos] = useState<Record<number, string>>(() => {
    const formatId = resolveCurrentFormatId();
    const saved = getSavedWorkflowRunData(formatId);
    if (saved?.enhancedPhotos && Object.keys(saved.enhancedPhotos).length > 0) {
      return saved.enhancedPhotos;
    }
    try {
      const fbSession = localStorage.getItem('estate_facebook_import_session_v1');
      if (fbSession) {
        const parsed = JSON.parse(fbSession);
        if (parsed?.enhancedPhotos) return parsed.enhancedPhotos;
      }
    } catch {}
    return {};
  });
  const [aiGeneratedOutputs, setAiGeneratedOutputs] = useState<Record<string, string>>(() => {
    const formatId = resolveCurrentFormatId();
    const saved = getSavedWorkflowRunData(formatId);
    if (saved?.aiGeneratedOutputs && Object.keys(saved.aiGeneratedOutputs).length > 0) {
      return saved.aiGeneratedOutputs;
    }
    try {
      const fbSession = localStorage.getItem('estate_facebook_import_session_v1');
      if (fbSession) {
        const parsed = JSON.parse(fbSession);
        if (parsed?.aiGeneratedOutputs) return parsed.aiGeneratedOutputs;
      }
    } catch {}
    return {};
  });
  const [aiGeneratedCopy, setAiGeneratedCopy] = useState<string>(() => {
    const formatId = resolveCurrentFormatId();
    const saved = getSavedWorkflowRunData(formatId);
    if (saved?.aiGeneratedCopy) return saved.aiGeneratedCopy;
    try {
      const fbSession = localStorage.getItem('estate_facebook_import_session_v1');
      if (fbSession) {
        const parsed = JSON.parse(fbSession);
        if (parsed?.aiGeneratedCopy) return parsed.aiGeneratedCopy;
      }
    } catch {}
    return '';
  });
  const [projectName, setProjectName] = useState<string>(() => {
    const formatId = resolveCurrentFormatId();
    const saved = getSavedWorkflowRunData(formatId);
    if (saved?.projectName) return saved.projectName;
    try {
      const fbSession = localStorage.getItem('estate_facebook_import_session_v1');
      if (fbSession) {
        const parsed = JSON.parse(fbSession);
        if (parsed?.propertyData?.project_name) return parsed.propertyData.project_name;
      }
    } catch {}
    return '';
  });
  const [propertyData, setPropertyData] = useState<any>(() => {
    const formatId = resolveCurrentFormatId();
    const saved = getSavedWorkflowRunData(formatId);
    if (saved?.propertyData) return saved.propertyData;
    try {
      const fbSession = localStorage.getItem('estate_facebook_import_session_v1');
      if (fbSession) {
        const parsed = JSON.parse(fbSession);
        if (parsed?.propertyData) return parsed.propertyData;
      }
    } catch {}
    return null;
  });
  const [isRunningWorkflow, setIsRunningWorkflow] = useState<boolean>(false);
  const [showLeaveConfirmModal, setShowLeaveConfirmModal] = useState<boolean>(false);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState<boolean>(false);
  const [pendingLeaveAction, setPendingLeaveAction] = useState<(() => void) | null>(null);
  const isCancelledRef = useRef<boolean>(false);
  const runIdRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const isRunStopped = (myRunId?: number) => {
    if (isCancelledRef.current) return true;
    if (myRunId !== undefined && runIdRef.current !== myRunId) return true;
    if (abortControllerRef.current?.signal.aborted) return true;
    return false;
  };

  const cancellableDelay = (ms: number, myRunId?: number) =>
    new Promise<void>((resolve) => {
      if (isRunStopped(myRunId)) {
        resolve();
        return;
      }
      const sig = abortControllerRef.current?.signal;
      const timer = setTimeout(() => {
        resolve();
      }, ms);
      if (sig) {
        sig.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            resolve();
          },
          { once: true }
        );
      }
    });

  const safeSetExecutionState = (
    myRunId: number,
    updater:
      | WorkflowExecutionState
      | undefined
      | ((prev: WorkflowExecutionState | undefined) => WorkflowExecutionState | undefined)
  ) => {
    if (isRunStopped(myRunId)) return;
    setExecutionState((prev) => {
      if (isRunStopped(myRunId)) return undefined;
      return typeof updater === 'function' ? updater(prev) : updater;
    });
  };

  const workflowContextRef = useRef<{
    rawCaption: string;
    imageList: any[];
    propData: any;
    projName: string;
    localWatermarkedMap: Record<number, string>;
    generatedOutputsMap: Record<string, string>;
    primaryCopy: string;
    targetUrl: string;
    listingCode: string;
  }>({
    rawCaption: '',
    imageList: [],
    propData: null,
    projName: '',
    localWatermarkedMap: {},
    generatedOutputsMap: {},
    primaryCopy: '',
    targetUrl: '',
    listingCode: '',
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
    const canvasFlag = searchParams.get('canvas') === 'true';
    if (urlId) {
      const found = formatsRef.current.find((f) => f.id === urlId);
      if (found) {
        setEditingFormat(found);
        setModalFormatName(found.name);
        setModalFormatDesc(found.description || '');
      }
      setIsCanvasOpen(true);
      if (found?.id) {
        setActiveWorkflowFormatId(found.id);
      }
      try {
        localStorage.setItem('ea_workflow_canvas_open', 'true');
      } catch {}
      window.dispatchEvent(new CustomEvent('ea_set_canvas_mode', { detail: { active: true } }));
    } else if (!canvasFlag) {
      // Missing id/format in URL -> return to format list view
      setIsCanvasOpen(false);
      try {
        localStorage.removeItem('ea_workflow_canvas_open');
      } catch {}
      window.dispatchEvent(new CustomEvent('ea_set_canvas_mode', { detail: { active: false } }));
    }
  }, [searchParams]);

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
    handleFormatNameCommit();
    // Ensure latest editingFormat with all node coordinates is committed synchronously before unmounting canvas
    if (editingFormat) {
      setFormats((latestFormats) => {
        const found = latestFormats.find((f) => f.id === editingFormat.id);
        const updatedList = found
          ? latestFormats.map((f) => (f.id === editingFormat.id ? editingFormat : f))
          : [...latestFormats, editingFormat];
        saveWorkflowFormatsList(updatedList);
        return updatedList;
      });
    }
    setIsCanvasOpen(false);
    try {
      localStorage.removeItem('ea_workflow_canvas_open');
    } catch {}
    window.dispatchEvent(new CustomEvent('ea_set_canvas_mode', { detail: { active: false } }));
    navigate('/create-workflow', { replace: false });
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
    runIdRef.current += 1;
    isCancelledRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsRunningWorkflow(false);
    (window as any).__isWorkflowProcessing = false;
    (window as any).__workflowConfirmLeave = null;
    setExecutionState((prev) => (prev ? { ...prev, isRunning: false, activeNodeIds: [] } : undefined));
    setShowLeaveConfirmModal(false);
    stopAutomation().catch((e) => console.warn('Failed to stop automation:', e));

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
    runIdRef.current += 1;
    isCancelledRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsRunningWorkflow(false);
    (window as any).__isWorkflowProcessing = false;
    (window as any).__workflowConfirmLeave = null;
    setExecutionState((prev) => (prev ? { ...prev, isRunning: false, activeNodeIds: [] } : undefined));
    // Halt external browser processing, companion, OpenClaw extractor, and queue dispatch immediately
    stopAutomation().catch((e) => console.warn('Failed to stop automation:', e));
  };

  // Sync format name and description when editingFormat changes
  useEffect(() => {
    if (editingFormat) {
      setModalFormatName(editingFormat.name || '');
      setModalFormatDesc(editingFormat.description || '');
    }
  }, [editingFormat?.id]);

  // Switch / restore saved execution data when editingFormat changes
  useEffect(() => {
    const targetId = editingFormat?.id || activeFormatId || getActiveWorkflowFormatId() || 'default';
    try {
      const saved = getSavedWorkflowRunData(targetId);
      if (saved) {
        if (saved.executionState) {
          setExecutionState({
            ...saved.executionState,
            isRunning: false,
            activeNodeIds: [],
          });
        }
        if (saved.runFacebookUrl !== undefined) setRunFacebookUrl(saved.runFacebookUrl);
        if (saved.extractedContent !== undefined) setExtractedContent(saved.extractedContent);
        if (Array.isArray(saved.extractedImages) && saved.extractedImages.length > 0) {
          setExtractedImages(saved.extractedImages);
        }
        if (saved.watermarkedPhotos) setWatermarkedPhotos(saved.watermarkedPhotos);
        if (saved.enhancedPhotos) setEnhancedPhotos(saved.enhancedPhotos);
        if (saved.aiGeneratedOutputs) setAiGeneratedOutputs(saved.aiGeneratedOutputs);
        if (saved.aiGeneratedCopy !== undefined) setAiGeneratedCopy(saved.aiGeneratedCopy);
        if (saved.projectName !== undefined) setProjectName(saved.projectName);
        else if (saved.propertyData?.project_name) setProjectName(saved.propertyData.project_name);
        if (saved.propertyData !== undefined) setPropertyData(saved.propertyData);
      }
    } catch {}
  }, [editingFormat?.id]);

  // Automatically persist workflow run data whenever outputs or execution states update
  useEffect(() => {
    const targetFormatId = editingFormat?.id || activeFormatId || getActiveWorkflowFormatId() || 'default';
    if (!targetFormatId) return;

    const hasData =
      Boolean(executionState && (executionState.completedNodeIds?.length || 0) > 0) ||
      extractedImages.length > 0 ||
      Boolean(extractedContent && extractedContent.trim().length > 0) ||
      Object.keys(aiGeneratedOutputs).length > 0 ||
      Object.keys(watermarkedPhotos).length > 0 ||
      Object.keys(enhancedPhotos).length > 0 ||
      Boolean(runFacebookUrl && runFacebookUrl.trim().length > 0);

    if (!hasData) return;

    try {
      const toSave = {
        executionState: executionState
          ? {
              ...executionState,
              isRunning: false,
              activeNodeIds: [],
            }
          : undefined,
        runFacebookUrl: runFacebookUrl || '',
        extractedContent,
        extractedImages,
        watermarkedPhotos,
        enhancedPhotos,
        aiGeneratedOutputs,
        aiGeneratedCopy,
        projectName,
        propertyData,
        timestamp: Date.now(),
      };
      localStorage.setItem(getWorkflowRunStorageKey(targetFormatId), JSON.stringify(toSave));
      localStorage.setItem('ea_workflow_execution_data_active', JSON.stringify(toSave));

      // Also keep estate_facebook_import_session_v1 synchronized so navigating to FB import or other views retains everything
      try {
        const existingRaw = localStorage.getItem('estate_facebook_import_session_v1');
        const parsed = existingRaw ? JSON.parse(existingRaw) : {};
        localStorage.setItem(
          'estate_facebook_import_session_v1',
          JSON.stringify({
            ...parsed,
            url: runFacebookUrl || parsed.url || '',
            caption: extractedContent || parsed.caption || '',
            images: extractedImages.length > 0 ? extractedImages : parsed.images || [],
            watermarkedPhotos: Object.keys(watermarkedPhotos).length > 0 ? watermarkedPhotos : parsed.watermarkedPhotos || {},
            enhancedPhotos: Object.keys(enhancedPhotos).length > 0 ? enhancedPhotos : parsed.enhancedPhotos || {},
            aiGeneratedOutputs: Object.keys(aiGeneratedOutputs).length > 0 ? aiGeneratedOutputs : parsed.aiGeneratedOutputs || {},
            aiGeneratedCopy: aiGeneratedCopy || parsed.aiGeneratedCopy || '',
            propertyData: propertyData || parsed.propertyData || { project_name: projectName },
          })
        );
      } catch {}
    } catch (err) {
      console.warn('Failed to persist workflow execution data:', err);
    }
  }, [
    editingFormat?.id,
    activeFormatId,
    executionState,
    runFacebookUrl,
    extractedContent,
    extractedImages,
    watermarkedPhotos,
    enhancedPhotos,
    aiGeneratedOutputs,
    aiGeneratedCopy,
    projectName,
    propertyData,
  ]);

  // Clear all extracted data and execution results on demand ONLY when user clicks Clear
  const handleClearRunData = () => {
    if (isRunningWorkflow) {
      handleStopWorkflow();
    }
    setExecutionState(undefined);
    setRunFacebookUrl('');
    setExtractedContent('');
    setExtractedImages([]);
    setWatermarkedPhotos({});
    setEnhancedPhotos({});
    setAiGeneratedOutputs({});
    setAiGeneratedCopy('');
    setProjectName('');
    setPropertyData(null);
    if (editingFormat?.id) {
      try {
        localStorage.removeItem(getWorkflowRunStorageKey(editingFormat.id));
      } catch {}
    }
    try {
      localStorage.removeItem(getWorkflowRunStorageKey('default'));
    } catch {}
    try {
      localStorage.removeItem('ea_workflow_execution_data_active');
    } catch {}
    try {
      localStorage.removeItem('estate_facebook_import_session_v1');
    } catch {}
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith('ea_workflow_execution_data_')) {
        localStorage.removeItem(k);
      }
    }
    window.dispatchEvent(new CustomEvent('ea_workflow_cleared'));
  };

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
      runIdRef.current += 1;
      isCancelledRef.current = true;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
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

  // Toggle Pin Workflow Format (Pinned workflow displays in the first row)
  const handleTogglePinFormat = (formatId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFormats((prev) => {
      const isCurrentlyPinned = prev.find((f) => f.id === formatId)?.isPinned;
      const nextPinned = !isCurrentlyPinned;
      const updated = prev.map((f) => {
        if (f.id === formatId) {
          return { ...f, isPinned: nextPinned };
        }
        return { ...f, isPinned: false };
      });
      setPinnedWorkflowFormatId(nextPinned ? formatId : '');
      saveWorkflowFormatsList(updated);
      return updated;
    });
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
    if (isCanvasOpen) {
      window.open('/facebook-import', '_blank');
    } else {
      navigate('/facebook-import');
    }
  };

  // Update canvas config
  const handleCanvasConfigChange = (newConfig: FacebookWorkflowConfig) => {
    if (!editingFormat) return;
    // Push previous config onto undo stack if config changed
    if (JSON.stringify(editingFormat.config) !== JSON.stringify(newConfig)) {
      setUndoStack((prev) => [...prev.slice(-30), editingFormat.config]);
    }
    const currentName = modalFormatName.trim() || editingFormat.name;
    const updated: WorkflowFormat = {
      ...editingFormat,
      name: currentName,
      config: newConfig,
      updatedAt: Date.now(),
    };
    setEditingFormat(updated);
    setFormats((prevFormats) => {
      const updatedList = prevFormats.map((f) => (f.id === editingFormat.id ? updated : f));
      saveWorkflowFormatsList(updatedList);
      return updatedList;
    });
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
    myRunId,
    signal,
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
    myRunId?: number;
    signal?: AbortSignal;
  }) => {
    const activeRunId = myRunId ?? runIdRef.current;
    const delay = (ms: number) => cancellableDelay(ms, activeRunId);
    let primaryCopy = initialPrimaryCopy;

    if (isRunStopped(activeRunId)) return;

    // Phase 4: Combine Boxes (Merge Parallel Branches)
    const activeCombineBoxes = (cfg.combineBoxes || []).filter((cb) => cb && cb.enabled !== false);
    const combinedOutputsMap: Record<string, { text: string; images: string[] }> = {};

    for (const cb of activeCombineBoxes) {
      if (isRunStopped(activeRunId)) return;

      safeSetExecutionState(activeRunId, (prev) => ({
        ...prev!,
        activeNodeIds: [cb.id],
        currentStepMessage: `⚡ Merging content & formatted images in [${cb.title || 'Combine Box'}]...`,
        stepIndex: 5,
      }));
      await delay(500);
      if (isRunStopped(activeRunId)) return;

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

      safeSetExecutionState(activeRunId, (prev) => ({
        ...prev!,
        completedNodeIds: Array.from(new Set([...(prev?.completedNodeIds || []), cb.id])),
        activeNodeIds: [],
        currentStepMessage: `✓ [${cb.title || 'Combine Box'}] merged ${inConns.length || 2} inputs successfully!`,
      }));
      await delay(300);
      if (isRunStopped(activeRunId)) return;
    }

    // Phase 5: Post Output (Compile Assets)
    if (cfg.outputNode?.enabled !== false) {
      if (isRunStopped(activeRunId)) return;
      safeSetExecutionState(activeRunId, (prev) => ({
        ...prev!,
        activeNodeIds: ['output'],
        currentStepMessage: '⚡ Compiling Final Content & Media package for dispatch...',
        stepIndex: 5,
      }));
      await delay(500);
      if (isRunStopped(activeRunId)) return;

      safeSetExecutionState(activeRunId, (prev) => ({
        ...prev!,
        completedNodeIds: Array.from(new Set([...(prev?.completedNodeIds || []), 'output'])),
        activeNodeIds: [],
        currentStepMessage: '✓ Final Content & Images compiled successfully!',
      }));
      await delay(300);
      if (isRunStopped(activeRunId)) return;
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

    if (isRunStopped(activeRunId)) return;

    safeSetExecutionState(activeRunId, (prev) => ({
      ...prev!,
      activeNodeIds: destIds,
      currentStepMessage: '🚀 Delivering to destinations in background (Social Post & Remaining Posts Database)...',
      stepIndex: 6,
    }));
    await delay(350);
    if (isRunStopped(activeRunId)) return;

    let anyFacebookPosted = false;
    let lastFbPostId = '';
    let lastFbPermalink = '';

    // 1. Process Direct Social Media Posting
    for (const socialDest of socialDestinations) {
      if (isRunStopped(activeRunId)) return;

      const targetPageId = socialDest.accountId || socialDest.selectedPageId || socialDest.selectedPageIds?.[0] || '1546086342286604';
      const destTitle = socialDest.accountName || socialDest.title || 'Facebook Page';

      // If this is a platform hub routing node that connects to a specific page account node,
      // pass through and let the downstream page account node execute the actual post.
      const isHubWithChildren = (cfg.connections || []).some(
        (c) => c.fromNodeId === socialDest.id && allDestinations.some((d) => d.id === c.toNodeId)
      );
      if (isHubWithChildren) {
        safeSetExecutionState(activeRunId, (prev) => ({
          ...prev!,
          completedNodeIds: Array.from(new Set([...(prev?.completedNodeIds || []), socialDest.id])),
          activeNodeIds: [],
          currentStepMessage: `✓ [${destTitle}] routed to connected Facebook Page.`,
        }));
        await delay(200);
        if (isRunStopped(activeRunId)) return;
        continue;
      }

      const isSchedule = (socialDest as any).publishMode === 'schedule';
      const scheduledIso = (socialDest as any).scheduledAt
        ? new Date((socialDest as any).scheduledAt).toISOString()
        : new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

      safeSetExecutionState(activeRunId, (prev) => ({
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
            signal,
          });
          if (isRunStopped(activeRunId)) return;

          const data = await res.json().catch(() => ({}));
          if (isRunStopped(activeRunId)) return;
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
            signal,
          });
          if (isRunStopped(activeRunId)) return;

          const data = await res.json().catch(() => ({}));
          if (isRunStopped(activeRunId)) return;
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
        if (isRunStopped(activeRunId)) return;
        errorMsg = err.message || 'Network error publishing to Facebook';
      }

      if (isRunStopped(activeRunId)) return;

      if (!publishedSuccess) {
        safeSetExecutionState(activeRunId, (prev) => ({
          ...prev!,
          isRunning: false,
          hasError: true,
          failedNodeIds: Array.from(new Set([...(prev?.failedNodeIds || []), socialDest.id])),
          activeNodeIds: [socialDest.id],
          currentStepMessage: `❌ Failed to publish to Facebook [${destTitle}]: ${errorMsg}`,
        }));
        return;
      }

      safeSetExecutionState(activeRunId, (prev) => ({
        ...prev!,
        completedNodeIds: Array.from(new Set([...(prev?.completedNodeIds || []), socialDest.id])),
        activeNodeIds: [],
        currentStepMessage: isSchedule
          ? `✓ Scheduled Facebook post for [${destTitle}] at ${new Date(scheduledIso).toLocaleString()}!`
          : `✓ Published to Facebook [${destTitle}] (Post ID: ${lastFbPostId})!`,
      }));

      await delay(400);
      if (isRunStopped(activeRunId)) return;
    }

    // 2. Process Remaining Posts Database Storage
    for (const dbDest of dbDestinations) {
      if (isRunStopped(activeRunId)) return;

      safeSetExecutionState(activeRunId, (prev) => ({
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

        safeSetExecutionState(activeRunId, (prev) => ({
          ...prev!,
          completedNodeIds: Array.from(new Set([...(prev?.completedNodeIds || []), dbDest.id])),
          activeNodeIds: [],
          currentStepMessage: `✓ Saved in [${dbDest.title || 'Remaining Posts Database'}]!`,
        }));
      } catch (dbErr) {
        console.error('Failed to save to Remaining Posts storage:', dbErr);
      }

      await delay(300);
      if (isRunStopped(activeRunId)) return;
    }

    if (isRunStopped(activeRunId)) return;

    // Final Completion (only mark nodes that were actually enabled and executed as completed)
    safeSetExecutionState(activeRunId, (prev) => ({
      ...prev!,
      isRunning: false,
      isComplete: true,
      hasError: false,
      activeNodeIds: [],
      completedNodeIds: Array.from(
        new Set([
          ...(prev?.completedNodeIds || ['trigger']),
          ...activeCombineBoxes.map((cb) => cb.id),
          ...destIds,
        ])
      ),
      currentStepMessage: anyFacebookPosted
        ? `✓ Workflow completed! "${projName || 'Listing'}" auto-posted directly to Facebook & delivered to all destinations.`
        : `✓ Workflow completed! "${projName || 'Listing'}" delivered to all destinations.`,
      stepIndex: 6,
      totalSteps: 6,
    }));
  };

  // Run Workflow directly on this Canvas screen smoothly
  const executeCanvasWorkflow = async (targetUrl: string) => {
    if (!editingFormat) return;
    const cfg = editingFormat.config;

    // Cancel any previous run and start a fresh run ID + AbortController
    runIdRef.current += 1;
    const myRunId = runIdRef.current;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const signal = controller.signal;

    setIsRunningWorkflow(true);
    isCancelledRef.current = false;
    (window as any).__isWorkflowProcessing = true;

    const delay = (ms: number) => cancellableDelay(ms, myRunId);

    try {
      // Reset previous run outputs
      setExtractedContent('');
      setExtractedImages([]);
      setWatermarkedPhotos({});
      setEnhancedPhotos({});
      setAiGeneratedOutputs({});
      setAiGeneratedCopy('');
      setProjectName('');

      const isManualTrigger = cfg.trigger?.sourceMode === 'manual';
      let platformLabel = 'Facebook';

      if (!isManualTrigger) {
        const platform = checkSocialPlatform(targetUrl);
        if (platform === 'unknown') {
          safeSetExecutionState(myRunId, {
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
        platformLabel = platform === 'tiktok' ? 'TikTok' : 'Facebook';
      } else {
        platformLabel = 'Manual Input';
      }

      const contentEnabled = cfg.getContent?.enabled !== false;
      const imagesEnabled = cfg.getImages?.enabled !== false;

      // Initialize workflow listing code
      const codeFormatPattern = (cfg as any)?.codeFormat || 'AAA-######-AA';
      const initialRunListingCode = generateUniqueListingCode(codeFormatPattern);

      // Phase 1: Trigger (Extract Link or Manual Input)
      safeSetExecutionState(myRunId, {
        isRunning: true,
        isComplete: false,
        hasError: false,
        activeNodeIds: ['trigger'],
        completedNodeIds: [],
        failedNodeIds: [],
        currentStepMessage: isManualTrigger
          ? 'Loading manual content & photos into workflow...'
          : `Resolving ${platformLabel} post link and isolating listing...`,
        stepIndex: 1,
        totalSteps: 6,
        listingCode: initialRunListingCode,
      });

      let rawCaption = '';
      let imageList: any[] = [];
      let propData: any = null;
      let projName = '';
      let extractFinished = false;
      let extractFailed = false;
      const extractStartTime = Date.now();

      if (isManualTrigger) {
        rawCaption = cfg.trigger?.manualContent || '';
        imageList = (cfg.trigger?.manualImages || []).map((img, idx) => ({
          index: idx,
          facebook_photo_id: `manual-photo-${idx + 1}`,
          source_url: img.url,
          stored_url: img.url,
          filename: img.filename || `Photo #${idx + 1}`,
          status: 'verified',
        }));
        if (!rawCaption && extractedContent) rawCaption = extractedContent;
        if (imageList.length === 0 && extractedImages.length > 0) imageList = extractedImages;

        const lines = rawCaption.split('\n').map((l) => l.trim()).filter(Boolean);
        projName = lines[0]?.slice(0, 50) || 'Manual Property Listing';
        propData = {
          id: `PROP-MANUAL-${Date.now()}`,
          project_name: projName,
          title: projName,
          raw_caption: rawCaption,
          images: imageList,
        };
        setProjectName(projName);
        setPropertyData(propData);
        setExtractedContent(rawCaption);
        setExtractedImages(imageList);
        extractFinished = true;
      }

      // Helper to update active/completed nodes for a branch without overwriting parallel branches
      const updateBranchNodes = (
        removeActiveIds: string[],
        addActiveIds: string[],
        addCompletedIds: string[],
        message?: string,
        extra?: Partial<WorkflowExecutionState>
      ) => {
        safeSetExecutionState(myRunId, (prev) => {
          const nextCompleted = Array.from(
            new Set([...(prev?.completedNodeIds || []), ...addCompletedIds])
          );
          const nextActive = Array.from(
            new Set([
              ...(prev?.activeNodeIds || []).filter(
                (id) => !removeActiveIds.includes(id) && ! nextCompleted.includes(id)
              ),
              ...addActiveIds,
            ])
          );
          return {
            ...prev!,
            completedNodeIds: nextCompleted,
            activeNodeIds: nextActive,
            listingCode: workflowContextRef.current?.listingCode || initialRunListingCode || prev?.listingCode,
            ...(message ? { currentStepMessage: message } : {}),
            ...(extra || {}),
          };
        });
      };

      // Initialize workflow context so parallel branches can populate outputs as they finish
      workflowContextRef.current = {
        rawCaption,
        imageList,
        propData,
        projName,
        localWatermarkedMap: {},
        generatedOutputsMap: {},
        primaryCopy: '',
        targetUrl: isManualTrigger ? 'manual://input' : targetUrl,
        listingCode: initialRunListingCode,
      };

      const generatedOutputsMap: Record<string, string> = {};
      const localWatermarkedMap: Record<number, string> = {};
      let primaryCopy = '';
      let branchFatalError = false;

      // Start full extraction request in background (returns both caption + downloaded images)
      const extractFetchPromise = isManualTrigger
        ? Promise.resolve(null)
        : (async () => {
        try {
          const extractResp = await fetch('/api/facebook-import/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: targetUrl,
              preferred_method: 'browser',
              max_images: 25,
            }),
            signal,
          });

          if (isRunStopped(myRunId)) return null;

          if (extractResp.ok) {
            const extractData = await extractResp.json();
            if (isRunStopped(myRunId)) return null;
            if (extractData.success && extractData.result) {
              const res = extractData.result;
              if (res.caption?.original) {
                rawCaption = res.caption.original;
              }
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
              setProjectName(projName);
              setPropertyData(propData);
              workflowContextRef.current.propData = propData;
              workflowContextRef.current.projName = projName;
              workflowContextRef.current.imageList = imageList;
              if (rawCaption) {
                workflowContextRef.current.rawCaption = rawCaption;
              }
              return res;
            }
          }
          extractFailed = true;
          return null;
        } catch (err) {
          if (!isRunStopped(myRunId)) {
            console.warn('Backend live extract call threw:', err);
          }
          extractFailed = true;
          return null;
        } finally {
          extractFinished = true;
        }
      })();

      // Step 1: Brief Trigger link resolution before fanning out to Get Content & Get Images in parallel
      await delay(1100);
      if (isRunStopped(myRunId)) return;

      const initialParallelBranches = [
        ...(contentEnabled ? ['get-content'] : []),
        ...(imagesEnabled ? ['get-images'] : []),
      ];
      updateBranchNodes(
        ['trigger'],
        initialParallelBranches,
        ['trigger'],
        contentEnabled && imagesEnabled
          ? 'Extracting post content & downloading high-resolution photos in parallel...'
          : contentEnabled
          ? 'Extracting post content, description & property attributes...'
          : 'Extracting & downloading high-resolution property photos...',
        { stepIndex: 2 }
      );

      // Helper to resolve caption as soon as browser_server.js extracts postInfo.caption (before image gallery finishes)
      const waitForCaptionReady = async (): Promise<string> => {
        if (isManualTrigger) {
          return rawCaption;
        }
        while (!extractFinished && !isRunStopped(myRunId)) {
          try {
            let progResp = await fetch('/api/facebook-import/progress', { signal }).catch(() => null);
            if (!progResp || !progResp.ok) {
              progResp = await fetch('http://localhost:9223/facebook-extract-progress', { signal }).catch(() => null);
            }
            if (progResp && progResp.ok) {
              const prog = await progResp.json();
              if (
                prog &&
                (prog.phase === 'caption_ready' || prog.phase === 'completed') &&
                prog.updatedAt >= extractStartTime - 2000 &&
                prog.caption &&
                prog.caption.trim().length > 0
              ) {
                rawCaption = prog.caption;
                workflowContextRef.current.rawCaption = rawCaption;
                return rawCaption;
              }
            }
          } catch {}
          await delay(450);
        }
        await extractFetchPromise;
        return rawCaption;
      };

      // Partition AI boxes into Content Branch vs Images Branch so they execute in parallel
      const topLevelAiBoxes = (cfg.aiBoxes || []).filter(
        (box) => !isChromeProfileAIBox(box) && !isChromeTabGroupAIBox(box)
      );

      const isImageBranchBox = (box: any): boolean => {
        if (
          isWatermarkAIBox(box) ||
          isExternalBrowserAIBox(box) ||
          box.processType === 'image_enhance' ||
          box.processType === 'image_upscale' ||
          box.provider === 'runware_ai'
        ) {
          return true;
        }
        const inConns = (cfg.connections || []).filter((c) => c.toNodeId === box.id);
        return inConns.some((c) => c.fromNodeId === 'get-images');
      };

      const contentBranchBoxes = topLevelAiBoxes.filter((b) => !isImageBranchBox(b));
      const imageBranchBoxes = topLevelAiBoxes.filter((b) => isImageBranchBox(b));

      // Group branch boxes into dependency waves so independent parallel nodes execute concurrently at the same time
      const buildExecutionWaves = (boxes: any[]): any[][] => {
        const boxIds = new Set(boxes.map((b) => b.id));
        const conns = cfg.connections || [];

        // For each box, find which OTHER boxes in this branch it directly depends on (incoming wires)
        const depsMap = new Map<string, Set<string>>();
        boxes.forEach((b) => {
          const directUpstream = conns
            .filter((c) => c.toNodeId === b.id && boxIds.has(c.fromNodeId))
            .map((c) => c.fromNodeId);
          depsMap.set(b.id, new Set(directUpstream));
        });

        const waves: any[][] = [];
        const completedIds = new Set<string>();
        let remainingBoxes = [...boxes];

        while (remainingBoxes.length > 0) {
          // Current wave: any box whose dependencies in this branch are all completed
          const currentWave = remainingBoxes.filter((b) => {
            const deps = depsMap.get(b.id) || new Set();
            return Array.from(deps).every((dId) => completedIds.has(dId));
          });

          // Safeguard against circular dependencies
          if (currentWave.length === 0) {
            waves.push(remainingBoxes);
            break;
          }

          waves.push(currentWave);
          currentWave.forEach((b) => completedIds.add(b.id));
          remainingBoxes = remainingBoxes.filter((b) => !completedIds.has(b.id));
        }

        return waves;
      };

      // Execute a single AI / Automation / Image box (safe for concurrent parallel branch execution)
      const executeSingleAIBox = async (box: any): Promise<boolean> => {
        if (isRunStopped(myRunId) || branchFatalError) return false;

        const isWatermark = isWatermarkAIBox(box);
        const isTextFormat = isTextFormatAIBox(box);
        const isN8N = isN8NAIBox(box);
        const isGoogleSheet = isGoogleSheetBox(box);
        const isExternalBrowser = isExternalBrowserAIBox(box);
        const executedProfileIds: string[] = [];
        const executedTabGroupIds: string[] = [];

        // External Browser is active only if the node itself is enabled AND at least one ENABLED
        // Chrome profile has at least one ENABLED tab group. Disabled profiles are simply skipped.
        let hasRunnableBrowserTarget = true;
        if (isExternalBrowser) {
          const areBoxesConnectedPre = (idA: string, idB: string) =>
            (cfg.connections || []).some(
              (c: any) => (c.fromNodeId === idA && c.toNodeId === idB) || (c.fromNodeId === idB && c.toNodeId === idA)
            );
          const isTabGroupBox = (b: any) => isChromeTabGroupAIBox(b) || (b as any).processType === 'chrome_tab_group';
          const isProfileBox = (b: any) => isChromeProfileAIBox(b) || (b as any).processType === 'chrome_profile';
          const isBoxAutoRunPre = box.autoRun !== false && (box as any).enableAutoRun !== false;
          const enabledProfilesPre = (cfg.aiBoxes || []).filter(
            (b: any) =>
              areBoxesConnectedPre(box.id, b.id) &&
              isProfileBox(b) &&
              b.enabled !== false &&
              b.autoRun !== false &&
              (b as any).enableAutoRun !== false
          );
          hasRunnableBrowserTarget =
            isBoxAutoRunPre &&
            enabledProfilesPre.some((pb: any) =>
              (cfg.aiBoxes || []).some(
                (b: any) =>
                  (areBoxesConnectedPre(pb.id, b.id) || areBoxesConnectedPre(box.id, b.id)) &&
                  isTabGroupBox(b) &&
                  b.enabled !== false &&
                  b.autoRun !== false &&
                  (b as any).enableAutoRun !== false
              )
            );
        }

        const isBoxDirectlyEnabled = box.enabled !== false;
        const isStepActive = isExternalBrowser
          ? (isBoxDirectlyEnabled && hasRunnableBrowserTarget)
          : isBoxDirectlyEnabled;

        if (!isStepActive) {
          // Step is disabled: skip completely without showing loading or done badges
          return true;
        }

        updateBranchNodes(
          [],
          [box.id],
          [],
          isWatermark
            ? `✂️ Applying photo crop & frame preset [${box.title || 'Format'}]...`
            : isExternalBrowser
            ? `🌐 Coordinating External Browser & Image Queue [${box.title || 'External Browser'}]...`
            : isTextFormat
            ? `📝 Formatting AI copy with [${box.title || 'Format Preset'}]...`
            : isN8N
            ? `🔄 Executing n8n Automation Engine [${box.title || 'n8n Workflow'}]...`
            : isGoogleSheet
            ? `📊 Appending row to Google Sheet [${box.title || 'Google Sheet'}]...`
            : `⚡ Generating AI copy with [${box.title || 'AI Model'}] (${box.model || 'Gemini 2.5 Flash'})...`,
          { stepIndex: 4 }
        );

        if (isWatermark) {
          if (!imageList || imageList.length === 0) {
            console.warn(`Skipping watermark box [${box.title}] because imageList is empty`);
            return true;
          }
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
            if (isRunStopped(myRunId) || branchFatalError) return false;
            const img = imageList[i];
            const rawUrl = img.stored_url
              ? (img.stored_url.startsWith('http') ? img.stored_url : `http://localhost:8085${img.stored_url}`)
              : img.source_url;
            try {
              const formattedDataUrl = await formatImageWithCropFormat(rawUrl, targetFormat);
              if (isRunStopped(myRunId) || branchFatalError) return false;
              localWatermarkedMap[img.index] = formattedDataUrl;
            } catch (err) {
              console.warn('Failed to format image with crop format', err);
              localWatermarkedMap[img.index] = rawUrl;
            }
          }
          if (isRunStopped(myRunId) || branchFatalError) return false;
          setWatermarkedPhotos((prev) => ({ ...prev, ...localWatermarkedMap }));
          workflowContextRef.current.localWatermarkedMap = { ...workflowContextRef.current.localWatermarkedMap, ...localWatermarkedMap };
          await delay(400);
          if (isRunStopped(myRunId) || branchFatalError) return false;
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
            if (isRunStopped(myRunId) || branchFatalError) return false;

            const respObj = runRes.webhook_response as Record<string, any>;
            if (respObj) {
              n8nCopyText = respObj.formatted_summary || respObj.summary || (typeof respObj === 'string' ? respObj : JSON.stringify(respObj, null, 2));
            }
          } catch (err: any) {
            if (isRunStopped(myRunId) || branchFatalError) return false;
            console.warn('n8n automation step error:', err);
            if (!(box as any).n8nContinueOnFailure) {
              branchFatalError = true;
              safeSetExecutionState(myRunId, (prev) => ({
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
              return false;
            }
          }

          if (isRunStopped(myRunId) || branchFatalError) return false;
          const finalText = n8nCopyText || upstreamText;
          generatedOutputsMap[box.id] = finalText;
          if (!primaryCopy) primaryCopy = finalText;
          setAiGeneratedOutputs((prev) => ({ ...prev, [box.id]: finalText }));
          await delay(400);
          if (isRunStopped(myRunId) || branchFatalError) return false;
        } else if (isGoogleSheet) {
          // Resolve post link from workflow context or targetUrl (from second image: Run Workflow dialog)
          let postLink =
            targetUrl ||
            workflowContextRef.current.targetUrl ||
            runFacebookUrl ||
            (cfg.trigger?.monitoredPageName && /^https?:\/\//i.test(cfg.trigger.monitoredPageName)
              ? cfg.trigger.monitoredPageName
              : '') ||
            (cfg.trigger?.manualContent && /^https?:\/\//i.test(cfg.trigger.manualContent.trim())
              ? cfg.trigger.manualContent.trim().split(/\s+/)[0]
              : '') ||
            (propData as any)?.source_url ||
            (propData as any)?.url ||
            '';
          if (postLink === 'manual://input') {
            postLink = (cfg.trigger?.monitoredPageName && /^https?:\/\//i.test(cfg.trigger.monitoredPageName) ? cfg.trigger.monitoredPageName : '') || (propData as any)?.source_url || '';
          }

          // Resolve property details from Get Content or upstream nodes
          const inConns = (cfg.connections || []).filter((c) => c.toNodeId === box.id);
          const upstreamBoxId = inConns[0]?.fromNodeId;
          let upstreamText =
            (upstreamBoxId && upstreamBoxId !== 'get-content' && generatedOutputsMap[upstreamBoxId]) ||
            rawCaption ||
            workflowContextRef.current.rawCaption ||
            extractedContent ||
            primaryCopy ||
            (propData as any)?.raw_caption ||
            (propData as any)?.description ||
            '';

          let rawSheetUrl = (box as any).googleSpreadsheetUrl || 'https://docs.google.com/spreadsheets/d/1lzY57D5ers2Xs6cvbV-skeqGSAK_jijbQJZt8Hn8udY/edit?gid=0#gid=0';
          if (rawSheetUrl.includes('https://') && rawSheetUrl.lastIndexOf('https://') > 0) {
            rawSheetUrl = rawSheetUrl.substring(rawSheetUrl.lastIndexOf('https://'));
          }
          const sheetName = (box as any).googleSheetName || '';
          let sheetHeaders = (box as any).googleSheetHeaders || [];
          if (!sheetHeaders || sheetHeaders.length === 0) {
            sheetHeaders = [
              'Code',
              'Project',
              'Room Type',
              'Size',
              'Floor',
              'Price',
              'BTS/MRT',
              'Owner/Agent',
              'Contact Info',
              'Original Link',
            ];
          }
          const customPrompt = (box as any).googleSheetAiPrompt || box.customPrompt || '';
          const condoProjectName = projName || workflowContextRef.current.projName || (propData as any)?.project_name || 'Featured Property Listing';
          const promptTemplate =
            box.templateText ||
            box.customPrompt ||
            (box as any).googleSheetAiPrompt ||
            DEFAULT_GOOGLE_SHEET_PROMPT;

          try {
            const syncRes = await fetch('/api/google-sheets/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                spreadsheet_url: rawSheetUrl,
                sheet_name: sheetName,
                headers: sheetHeaders,
                content: upstreamText,
                condo_name: condoProjectName,
                images: imageList.map((img) => img.stored_url || img.source_url),
                post_url: postLink,
                source_url: postLink,
                link: postLink,
                custom_instructions: customPrompt,
                model: box.model || 'gemini-1.5-flash',
                provider: box.provider || 'google_ai',
                prompt_template: promptTemplate,
                credentials_json: (box as any).googleServiceAccountJson || '',
                code_format: (box as any).codeFormat || (cfg as any)?.codeFormat || 'AAA-######-AA',
                auto_generate_code: (box as any).autoGenerateCode !== undefined ? (box as any).autoGenerateCode : ((cfg as any)?.autoGenerateCode !== undefined ? (cfg as any).autoGenerateCode : true),
                listing_code: (box as any).useGeneratedCode !== false ? (workflowContextRef.current?.listingCode || initialRunListingCode) : '',
              }),
            });

            const syncData = await syncRes.json();
            if (!syncRes.ok || !syncData.success) {
              throw new Error(syncData.error || 'Failed to sync with Google Sheets');
            }

            const formattedResult = JSON.stringify(syncData.mapped_data, null, 2);
            generatedOutputsMap[box.id] = formattedResult;
            if (!primaryCopy) primaryCopy = formattedResult;
            setAiGeneratedOutputs((prev) => ({ ...prev, [box.id]: formattedResult }));
            if (workflowContextRef.current) {
              workflowContextRef.current.generatedOutputsMap[box.id] = formattedResult;
            }
          } catch (err: any) {
            if (isRunStopped(myRunId) || branchFatalError) return false;
            console.warn('Google Sheet step error:', err);
            safeSetExecutionState(myRunId, (prev) => ({
              ...prev!,
              hasError: true,
              activeNodeIds: (prev?.activeNodeIds || []).filter((id) => id !== box.id),
              failedNodeIds: Array.from(new Set([...(prev?.failedNodeIds || []), box.id])),
              currentStepMessage: `❌ Google Sheet Sync failed for [${box.title || 'Google Sheet'}]: ${err.message || 'Sync error'}.`,
            }));
            canvasRef.current?.openNodeDrawer(box.id);
            return false;
          }

          if (isRunStopped(myRunId) || branchFatalError) return false;
          await delay(400);
          if (isRunStopped(myRunId) || branchFatalError) return false;
        } else if (isExternalBrowser) {
          if (!imageList || imageList.length === 0) {
            console.warn(`Skipping External Browser [${box.title}] because imageList is empty`);
            return true;
          }
          // Collect ALL enabled chrome_profile nodes wired to this External Browser node.
          // Each enabled profile runs in PARALLEL (like parallel AI Model nodes); disabled profiles are skipped.
          const propIdBase = (propData as any)?.id || `PROP-${Date.now()}`;
          const propName = projName || (propData as any)?.project_name || 'Featured Property Listing';

          const areBoxesConnected = (idA: string, idB: string) => {
            return (cfg.connections || []).some(
              (c: any) => (c.fromNodeId === idA && c.toNodeId === idB) || (c.fromNodeId === idB && c.toNodeId === idA)
            );
          };

          let enabledProfiles: any[] = (cfg.aiBoxes || []).filter(
            (b: any) =>
              areBoxesConnected(box.id, b.id) &&
              (isChromeProfileAIBox(b) || (b as any).processType === 'chrome_profile') &&
              b.enabled !== false
          );
          if (enabledProfiles.length === 0 && isChromeProfileAIBox(box) && box.enabled !== false) {
            enabledProfiles = [box];
          }

          const runBrowserTarget = async (
            connectedProfileBox: any,
            connectedTabGroupBox: any,
            propId: string
          ): Promise<boolean> => {
            const isTabGroupEnabled = connectedTabGroupBox ? connectedTabGroupBox.enabled !== false : true;
            const isTabGroupAutoRun = connectedTabGroupBox
              ? connectedTabGroupBox.autoRun !== false && (connectedTabGroupBox as any).enableAutoRun !== false
              : true;
            const isProfileAutoRun = connectedProfileBox
              ? connectedProfileBox.autoRun !== false && (connectedProfileBox as any).enableAutoRun !== false
              : true;
            const isBoxAutoRun = box.autoRun !== false && (box as any).enableAutoRun !== false;

            const groupName = connectedTabGroupBox?.browserGroupName || connectedTabGroupBox?.title || (box as any).browserGroupName || 'Enhance IMG';
            const tabGroupNodeId: string = connectedTabGroupBox?.id || box.id;

            if (!isTabGroupEnabled || !isTabGroupAutoRun || !isProfileAutoRun || !isBoxAutoRun) {
              console.log(
                `[Workflow] Tab Group [${groupName}] auto-run is disabled (enabled=${isTabGroupEnabled}, tabGroupAutoRun=${isTabGroupAutoRun}, profileAutoRun=${isProfileAutoRun}, boxAutoRun=${isBoxAutoRun}). Skipping browser execution.`
              );
              updateBranchNodes(
                [],
                [tabGroupNodeId],
                [],
                `⏸️ Auto-run disabled for [${groupName}]. Skipped.`
              );
              await delay(200);
              return true;
            }

            const profId = connectedProfileBox?.browserProfileId || (box as any).browserProfileId;
            const profKey = connectedProfileBox?.browserProfileKey || connectedProfileBox?.browserProfileName || (box as any).browserProfileKey || '';
            const profName = connectedProfileBox?.title || connectedProfileBox?.browserProfileName || '';

            const targetTabId = (connectedTabGroupBox as any)?.browserTabId || (box as any).browserTabId || (box as any).browserPromptTabId || (box as any).browserGenerateTabId || '';

            if (connectedTabGroupBox?.id) executedTabGroupIds.push(connectedTabGroupBox.id);
            if (connectedProfileBox?.id) executedProfileIds.push(connectedProfileBox.id);

            // ── Step 1: External Browser Node ──
            updateBranchNodes(
              [],
              [box.id],
              [],
              `🌐 Connecting to External Browser Engine [${box.title || 'External Browser'}]...`,
              { stepIndex: 4, propertyId: propId }
            );
            await delay(450);
            if (isRunStopped(myRunId) || branchFatalError) return false;

            // ── Step 2: Chrome Profile Node ──
            if (connectedProfileBox) {
              updateBranchNodes(
                [box.id],
                [connectedProfileBox.id],
                [box.id],
                `👤 Connecting to Chrome Profile [${profName}]...`
              );
              try {
                await openBrowserProfile(profId, profKey);
              } catch (pErr) {
                console.warn('Profile open warning:', pErr);
              }
              if (isRunStopped(myRunId) || branchFatalError) return false;
              await delay(600);
              if (isRunStopped(myRunId) || branchFatalError) return false;
            }

            // ── Step 3: Chrome Tab Group Node ──
            updateBranchNodes(
              [box.id, ...(connectedProfileBox ? [connectedProfileBox.id] : [])],
              [tabGroupNodeId],
              [box.id, ...(connectedProfileBox ? [connectedProfileBox.id] : [])],
              `📂 Opening Tab Group [${groupName}]...`
            );

            let targetUrls = connectedTabGroupBox?.browserGroupTabUrls ||
              ((connectedTabGroupBox as any)?._liveGroupTabs || []).map((t: any) => t.url).filter(Boolean) ||
              (box as any).browserGroupTabUrls;

            if (!targetUrls || targetUrls.length === 0) {
              try {
                const fetched = await fetchTabGroups(profId, profKey, profName);
                if (isRunStopped(myRunId) || branchFatalError) return false;
                const m = fetched.find((g) => g.name.toLowerCase() === groupName.toLowerCase());
                if (m && m.tabs && m.tabs.length > 0) {
                  targetUrls = m.tabs.map((t) => t.url).filter(Boolean);
                }
              } catch (e) {}
            }
            if (isRunStopped(myRunId) || branchFatalError) return false;

            if (!targetUrls || targetUrls.length === 0) {
              targetUrls = [
                'https://chatgpt.com/',
                'https://chatgpt.com/',
                'https://chatgpt.com/',
                'https://chatgpt.com/',
              ];
            }

            const isStagingGroup = groupName.toLowerCase().includes('hero') || groupName.toLowerCase().includes('stage');
            const isEnhanceGroup = groupName.toLowerCase().includes('enhance') || !isStagingGroup;
            const isDirectStagingGroup =
              (connectedTabGroupBox as any)?.stagingMode === 'direct_tab2' ||
              (connectedTabGroupBox as any)?.skipTab1 === true ||
              (box as any).stagingMode === 'direct_tab2' ||
              (box as any).skipTab1 === true ||
              (connectedTabGroupBox as any)?.workerTabCount === 1 ||
              (box as any).workerTabCount === 1;

            const tabMode = ((connectedTabGroupBox as any)?.workerTabMode || (connectedTabGroupBox as any)?.boxConfig?.workerTabMode || (box as any).workerTabMode || 'existing_tabs') as 'existing_tabs' | 'new_tabs';
            const explicitBoxCount = (connectedTabGroupBox as any)?.workerTabCount || (connectedTabGroupBox as any)?.boxConfig?.workerTabCount || (box as any).workerTabCount;
            const workerCount = (
              explicitBoxCount != null
                ? Math.max(1, parseInt(explicitBoxCount, 10))
                : (isStagingGroup ? (isDirectStagingGroup ? 1 : 2) : 4)
            ) as number;
            const reuseSession = ((connectedTabGroupBox as any)?.reuseSessionTabs ?? (connectedTabGroupBox as any)?.boxConfig?.reuseSessionTabs ?? (box as any).reuseSessionTabs ?? true) as boolean;

            if (targetUrls && targetUrls.length > workerCount) {
              targetUrls = targetUrls.slice(0, workerCount);
            }

            try {
              if (isRunStopped(myRunId) || branchFatalError) return false;
              await focusBrowserTabGroup({
                profileId: profId,
                profileKey: profKey,
                groupName: groupName,
                tabId: targetTabId,
                groupTabUrls: targetUrls,
                url: targetUrls?.[0],
                tabMode: tabMode,
                workerCount: workerCount,
                reuseSessionTabs: reuseSession,
                force: true,
              });
              if (isRunStopped(myRunId) || branchFatalError) return false;

              // Actively verify and wait until Chrome and selected tab group are verified open in browser
              const readyResult = await waitForBrowserTabsReady({
                profileKey: profKey,
                groupName: groupName,
                expectedUrls: targetUrls,
                tabMode: tabMode,
                workerCount: workerCount,
                maxWaitMs: 3000,
                shouldCancel: () => isRunStopped(myRunId) || branchFatalError,
                signal,
                onProgress: (msg) => {
                  updateBranchNodes([], [tabGroupNodeId], [], msg);
                },
              });
              if (isRunStopped(myRunId) || branchFatalError) return false;

              if (readyResult.verified) {
                updateBranchNodes(
                  [],
                  [tabGroupNodeId],
                  [],
                  `✓ Tab Group [${groupName}] (${workerCount} ${workerCount === 1 ? 'Tab' : 'Tabs'}) confirmed active in browser [${profName}]!`
                );
                await delay(500);
                if (isRunStopped(myRunId) || branchFatalError) return false;
              }
            } catch (openErr) {
              if (isRunStopped(myRunId) || branchFatalError) return false;
              console.warn('Could not auto-open Chrome profile and tab group:', openErr);
            }

            if (isRunStopped(myRunId) || branchFatalError) return false;

            const runEnhance = isEnhanceGroup && imageList.length > 0 && isTabGroupEnabled;
            const runStaging = isStagingGroup && isTabGroupEnabled;

            if (isEnhanceGroup && imageList.length === 0 && isTabGroupEnabled) {
              updateBranchNodes(
                [],
                [tabGroupNodeId],
                [],
                `⚠️ [${groupName}] Tab group open in Chrome. (0 photos to enhance)`
              );
              await delay(800);
              if (isRunStopped(myRunId) || branchFatalError) return false;
            }

            // ── PHASE 1: PHOTO ENHANCEMENT ACROSS 4 TABS (Enhance IMG) ──
            if (runEnhance) {
              if (isRunStopped(myRunId) || branchFatalError) return false;

              // Filter effective images to enhance based on Tab Group configuration
              let targetImages = imageList;
              const tabGroupImgSourceMode =
                connectedTabGroupBox?.imageSourceMode || (box as any).imageSourceMode || 'all';
              const tabGroupSelectedIndices: number[] =
                connectedTabGroupBox?.selectedImageIndices || (box as any).selectedImageIndices || [];

              if (tabGroupImgSourceMode === 'hero_only') {
                targetImages = imageList.slice(0, 1);
              } else if (
                (tabGroupImgSourceMode === 'selected' ||
                  (tabGroupSelectedIndices.length > 0 && tabGroupSelectedIndices.length < imageList.length)) &&
                tabGroupSelectedIndices.length > 0
              ) {
                targetImages = imageList.filter((_img, i) =>
                  tabGroupSelectedIndices.includes(i + 1)
                );
                if (targetImages.length === 0) {
                  targetImages = imageList.slice(0, 1);
                }
              }

              const totalImages = targetImages.length;
              const extPhotosMap: Record<number, string> = {};
              targetImages.forEach((img, idx) => {
                const origPos = imageList.indexOf(img);
                const pos = origPos >= 0 ? origPos : idx;
                extPhotosMap[pos] = img.stored_url || img.source_url;
              });

              const enhancePrompt = resolvePromptForBrowserNode(box, {
                title: propName,
                width: (box as any).outputWidth || (box as any).targetWidth || 1080,
                height: (box as any).outputHeight || (box as any).targetHeight || 1350,
              });

              const rawImgs = targetImages.map((img, i) => {
                const origPos = imageList.indexOf(img);
                const pos = origPos >= 0 ? origPos : i;
                return {
                  index: i + 1,
                  original_position: pos + 1,
                  source_url: img.source_url || img.stored_url,
                  stored_url: img.stored_url || img.source_url,
                  local_path: (img as any).local_path || '',
                  sha256: (img as any).sha256 || '',
                  width: (box as any).outputWidth || (box as any).targetWidth || 1080,
                  height: (box as any).outputHeight || (box as any).targetHeight || 1350,
                  resolved_prompt: enhancePrompt,
                };
              });

              const queuePayload = {
                property_id: propId,
                property_name: propName,
                prompt_template_text: enhancePrompt,
                prompt_template_id: (box as any).browserPromptTemplateKey || getPersistedPromptKey() || 'photo_retouch',
                images: rawImgs,
                processing_mode: (box as any).browserProcessingMode || 'chrome_assisted',
                lane_id: (box as any).browserLaneKey || 'lane-1',
                output_width: (box as any).outputWidth || (box as any).targetWidth || 1080,
                output_height: (box as any).outputHeight || (box as any).targetHeight || 1350,
                strict_preservation_active: (box as any).strictPreservationActive !== false,
                property_metadata: {
                  listing_code: workflowContextRef.current?.listingCode || initialRunListingCode,
                },
              };

              try {
                await createBatchImageQueue(queuePayload);
                if (isRunStopped(myRunId) || branchFatalError) {
                  await stopAutomation().catch(() => {});
                  return false;
                }
                await startImageQueue(propId);
              } catch (e) {
                console.warn('External browser queue start notice:', e);
              }
              if (isRunStopped(myRunId) || branchFatalError) {
                await stopAutomation().catch(() => {});
                return false;
              }

              updateBranchNodes(
                [],
                [box.id],
                [],
                `⚡ Phase 1: Distributing ${totalImages} images across ${workerCount} ChatGPT tabs [${groupName}]...`
              );

              try {
                await startAutomation({
                  property_id: propId,
                  listing_code: workflowContextRef.current?.listingCode || initialRunListingCode,
                  profile_key: profKey,
                  group_name: groupName,
                  tab_ids: Array.from({ length: workerCount }, (_, i) => i + 1),
                  tab_mode: tabMode,
                  worker_count: workerCount,
                  reuse_session_tabs: reuseSession,
                });
              } catch (autoErr) {
                console.warn('Automation start error:', autoErr);
              }
              if (isRunStopped(myRunId) || branchFatalError) {
                await stopAutomation().catch(() => {});
                return false;
              }

              let pollAttempts = 0;
              const maxPollAttempts = 150;
              let isDone = false;

              while (!isDone && pollAttempts < maxPollAttempts) {
                if (isRunStopped(myRunId) || branchFatalError) {
                  await stopAutomation().catch(() => {});
                  return false;
                }
                pollAttempts++;
                await delay(2000);
                if (isRunStopped(myRunId) || branchFatalError) {
                  await stopAutomation().catch(() => {});
                  return false;
                }

                try {
                  const queueJobs = await fetchImageQueue(propId);
                  if (isRunStopped(myRunId) || branchFatalError) {
                    await stopAutomation().catch(() => {});
                    return false;
                  }
                  const status = await getAutomationStatus();
                  if (isRunStopped(myRunId) || branchFatalError) {
                    await stopAutomation().catch(() => {});
                    return false;
                  }

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

                  updateBranchNodes(
                    [box.id],
                    [tabGroupNodeId],
                    [],
                    `⚡ Phase 1: Enhancing images across 4 ChatGPT tabs: ${completedCount}/${totalImages} completed...`
                  );

                  if (completedCount >= totalImages || (status && !status.is_running && (status.completed || 0) >= totalImages)) {
                    isDone = true;
                    break;
                  }
                } catch (pollErr) {
                  console.warn('Enhancement status check warning:', pollErr);
                }
              }

              if (isRunStopped(myRunId) || branchFatalError) {
                await stopAutomation().catch(() => {});
                return false;
              }

              updateBranchNodes(
                [],
                [tabGroupNodeId],
                [],
                `✓ Phase 1 complete: All ${totalImages} images enhanced and downloaded!`
              );
              await delay(600);
              if (isRunStopped(myRunId) || branchFatalError) return false;

              setEnhancedPhotos((prev) => ({ ...prev, ...extPhotosMap }));
              workflowContextRef.current.localWatermarkedMap = { ...workflowContextRef.current.localWatermarkedMap, ...extPhotosMap };
            }

            // ── PHASE 2: STAGING & AD CREATION (2 TABS e.g. FB Hero) ──
            if (runStaging) {
              if (isRunStopped(myRunId) || branchFatalError) return false;
              const stagingBox: any = connectedTabGroupBox || box;
              const stagingGroupTarget = stagingBox.stagingGroupName || (box as any).stagingGroupName || groupName || 'FB Hero';

              // Resolve Condo Name AI Box (wait briefly if parallel Content branch is still generating it)
              const targetCondoAiBoxId =
                stagingBox.condoNameAiBoxId ||
                (box as any).condoNameAiBoxId ||
                contentBranchBoxes.find(
                  (b: any) =>
                    b.enabled !== false &&
                    (b.title?.toLowerCase().includes('condo') || b.title?.toLowerCase().includes('name'))
                )?.id;

              if (targetCondoAiBoxId && contentEnabled) {
                const condoBoxObj = contentBranchBoxes.find((b: any) => b.id === targetCondoAiBoxId);
                if (condoBoxObj && condoBoxObj.enabled !== false) {
                  let waitCondoTicks = 0;
                  while (!generatedOutputsMap[targetCondoAiBoxId] && waitCondoTicks < 40 && !branchFatalError && !isRunStopped(myRunId)) {
                    await delay(400);
                    waitCondoTicks++;
                  }
                }
              }

              const aiExtractedCondo =
                targetCondoAiBoxId && generatedOutputsMap[targetCondoAiBoxId]
                  ? extractCleanCondoNameFromAiText(generatedOutputsMap[targetCondoAiBoxId])
                  : '';

              const effectiveCondoName =
                aiExtractedCondo ||
                stagingBox.browserCondoName ||
                (box as any).browserCondoName ||
                propName;

              // Also resolve upstream AI prompt if promptSourceMode is upstream_ai
              const targetPromptAiId =
                stagingBox.selectedUpstreamAiId ||
                (box as any).selectedUpstreamAiId ||
                contentBranchBoxes.find((b: any) => b.title?.toLowerCase().includes('hero') || b.title?.toLowerCase().includes('prompt'))?.id;

              if (targetPromptAiId && contentEnabled) {
                const promptBoxObj = contentBranchBoxes.find((b: any) => b.id === targetPromptAiId);
                if (promptBoxObj && promptBoxObj.enabled !== false) {
                  let waitPromptTicks = 0;
                  while (!generatedOutputsMap[targetPromptAiId] && waitPromptTicks < 40 && !branchFatalError && !isRunStopped(myRunId)) {
                    await delay(400);
                    waitPromptTicks++;
                  }
                } else if (promptBoxObj && !generatedOutputsMap[targetPromptAiId] && (rawCaption || primaryCopy)) {
                  // If the linked AI Generator Node (e.g. FB Hero Prompt) is selected in Direct Mode but disabled on canvas, generate its prompt on the fly so Direct Mode has the real property prompt!
                  try {
                    const aiProvider = promptBoxObj.provider || (promptBoxObj.model?.startsWith('gpt-') ? 'openai' : 'google_ai');
                    const aiModel = promptBoxObj.model || (aiProvider === 'openai' ? 'gpt-4o' : 'gemini-flash-lite-latest');
                    const generatedPrompt = await requestAIGeneration({
                      provider: aiProvider,
                      model: aiModel,
                      template_id: promptBoxObj.templateId || '',
                      template_name: promptBoxObj.title || 'FB Hero Prompt',
                      template_text: promptBoxObj.templateText || '',
                      raw_content: rawCaption || primaryCopy,
                      custom_prompt: promptBoxObj.customPrompt || '',
                    }, signal);
                    if (generatedPrompt) {
                      generatedOutputsMap[targetPromptAiId] = generatedPrompt;
                      workflowContextRef.current.generatedOutputsMap[targetPromptAiId] = generatedPrompt;
                      setAiGeneratedOutputs((prev) => ({ ...prev, [targetPromptAiId]: generatedPrompt }));
                    }
                  } catch {}
                }
              }

              const initialPrompt =
                (targetPromptAiId && generatedOutputsMap[targetPromptAiId]) ||
                resolvePromptForBrowserNode(stagingBox, {
                  title: effectiveCondoName,
                  width: stagingBox.outputWidth || (box as any).outputWidth || (box as any).targetWidth || 1080,
                  height: stagingBox.outputHeight || (box as any).outputHeight || (box as any).targetHeight || 1350,
                });
              const useRefImg = stagingBox.useReferenceImage !== false && (box as any).useReferenceImage !== false;
              const resolvedRefImage = useRefImg
                ? (stagingBox.referenceImage ||
                   (box as any).referenceImage ||
                   getPersistedReferenceImage(connectedTabGroupBox?.id) ||
                   (await loadPersistedReferenceImageAsync(connectedTabGroupBox?.id)) ||
                   null)
                : null;

              updateBranchNodes(
                [],
                [tabGroupNodeId],
                [],
                isDirectStagingGroup
                  ? `🚀 Direct Mode (1 Tab): Attaching Reference Image + 3 Condo Photos (${effectiveCondoName}) + Prompt in [${stagingGroupTarget}]...`
                  : `🚀 2-Stage Mode (2 Tabs): Pasting & generating prompt for ${effectiveCondoName} in [${stagingGroupTarget}]...`
              );

              try {
                await fetch('http://127.0.0.1:9224/start-two-stage-staging', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    profile_key: profKey,
                    group_name: stagingGroupTarget,
                    condo_name: effectiveCondoName,
                    initial_prompt: initialPrompt,
                    reference_image: resolvedRefImage,
                    target_folder: stagingBox.targetFolder || (box as any).targetFolder || localStorage.getItem('bolthaven_condo_target_folder') || '',
                    use_condo_images: stagingBox.useCondoImages !== false && (box as any).useCondoImages !== false,
                    use_reference_image: useRefImg,
                    skip_tab1: isDirectStagingGroup,
                    tab_mode: tabMode,
                    worker_count: isDirectStagingGroup ? 1 : 2,
                    reuse_session_tabs: reuseSession,
                  }),
                  signal,
                });
                if (isRunStopped(myRunId) || branchFatalError) {
                  await stopAutomation().catch(() => {});
                  return false;
                }

                let twoStageDone = false;
                let attempts = 0;
                while (!twoStageDone && attempts < 180) {
                  if (isRunStopped(myRunId) || branchFatalError) {
                    await stopAutomation().catch(() => {});
                    return false;
                  }
                  attempts++;
                  await delay(2000);
                  if (isRunStopped(myRunId) || branchFatalError) {
                    await stopAutomation().catch(() => {});
                    return false;
                  }
                  try {
                    const st = await fetch('http://127.0.0.1:9224/two-stage-status', { signal }).then((r) => r.json());
                    if (isRunStopped(myRunId) || branchFatalError) {
                      await stopAutomation().catch(() => {});
                      return false;
                    }
                    if (st && st.state) {
                      if (st.state.step === 'stopped') {
                        return false;
                      } else if (st.state.step === 'stage1_running') {
                        updateBranchNodes([], [tabGroupNodeId], [], `⏳ Tab 1: Generating & extracting prompt copy...`);
                      } else if (st.state.step === 'stage1_completed') {
                        updateBranchNodes(
                          [],
                          [tabGroupNodeId],
                          [],
                          isDirectStagingGroup
                            ? `⚡ Direct Mode (1 Tab): Prompt ready, attaching Reference Image + 3 Condo Photos...`
                            : `✓ Tab 1 prompt extracted! Switching to Tab 2...`
                        );
                      } else if (st.state.step === 'stage2_running') {
                        updateBranchNodes([], [tabGroupNodeId], [], `🖼️ Attaching Reference Image (1st), Condo Photos 1, 2, 3 (next) & Prompt...`);
                      } else if (st.state.step === 'generating_image') {
                        updateBranchNodes([], [tabGroupNodeId], [], st.state.message || `🎨 Generating Hero Image in ChatGPT...`);
                      } else if (st.state.step === 'downloading_image') {
                        updateBranchNodes([], [tabGroupNodeId], [], st.state.message || `⬇️ Downloading generated Hero Image...`);
                      } else if (st.state.step === 'completed') {
                        twoStageDone = true;
                        const heroResultUrl = st.state.downloaded_data_url || st.state.result_url;
                        if (heroResultUrl) {
                          try {
                            localStorage.setItem(
                              'bolthaven_last_hero_image',
                              JSON.stringify({
                                url: heroResultUrl,
                                condoName: projName,
                                timestamp: Date.now(),
                              })
                            );
                            window.dispatchEvent(
                              new CustomEvent('bolthaven_hero_image_updated', {
                                detail: { url: heroResultUrl, condoName: projName },
                              })
                            );
                          } catch (e) {}
                        }
                        updateBranchNodes(
                          [],
                          [tabGroupNodeId],
                          [],
                          `✓ Complete: Hero Image generated & downloaded in [${stagingGroupTarget}]!`
                        );
                      } else if (st.state.step === 'error') {
                        break;
                      }
                    }
                  } catch (e) {
                    if (isRunStopped(myRunId) || branchFatalError) return false;
                  }
                }
              } catch (twoStageErr: any) {
                if (isRunStopped(myRunId) || branchFatalError) return false;
                console.warn('Two-stage staging execution error:', twoStageErr);
              }
            }
            return true;
          };

          // Run every enabled profile in parallel; inside one profile, run its enabled tab groups in order.
          const profileResults = await Promise.all(
            enabledProfiles.map(async (profileBox: any, pIdx: number) => {
              const profileTabGroups: any[] = (cfg.aiBoxes || []).filter(
                (b: any) =>
                  areBoxesConnected(profileBox.id, b.id) &&
                  (isChromeTabGroupAIBox(b) || (b as any).processType === 'chrome_tab_group') &&
                  b.enabled !== false &&
                  b.autoRun !== false &&
                  (b as any).enableAutoRun !== false
              );
              const targets: any[] = profileTabGroups.length > 0
                ? profileTabGroups
                : (cfg.aiBoxes || []).filter(
                    (b: any) =>
                      areBoxesConnected(box.id, b.id) &&
                      (isChromeTabGroupAIBox(b) || (b as any).processType === 'chrome_tab_group') &&
                      b.enabled !== false &&
                      b.autoRun !== false &&
                      (b as any).enableAutoRun !== false
                  );
              if (targets.length === 0) return true;
              // Unique queue id per profile so parallel profiles never share one image queue
              const profilePropId = enabledProfiles.length > 1 ? `${propIdBase}-p${pIdx + 1}` : propIdBase;
              for (const tg of targets) {
                if (isRunStopped(myRunId) || branchFatalError) return false;
                const ok = await runBrowserTarget(profileBox, tg, profilePropId);
                if (!ok) return false;
              }
              return true;
            })
          );
          if (profileResults.some((r) => !r)) return false;
        } else {
          // Resolve upstream text for this text AI or format node
          const inConns = (cfg.connections || []).filter((c) => c.toNodeId === box.id);
          const upstreamParts: string[] = [];
          for (const conn of inConns) {
            const out = generatedOutputsMap[conn.fromNodeId] || (conn.fromNodeId === 'get-content' ? rawCaption : '');
            if (out && out.trim().length > 0) {
              upstreamParts.push(out);
            }
          }
          let upstreamText =
            upstreamParts.filter(Boolean).join('\n\n') ||
            primaryCopy ||
            rawCaption ||
            '';

          if (!upstreamText || upstreamText.trim().length === 0) {
            console.warn(`Skipping AI generation for [${box.title}] because upstream text is empty`);
            return true;
          }

          let copyText = '';
          const aiProvider = box.provider || (box.model?.startsWith('gpt-') ? 'openai' : 'google_ai');
          let aiModel = box.model || (aiProvider === 'openai' ? 'gpt-4o' : 'gemini-flash-lite-latest');
          if (aiModel === 'gemini-2.5-flash' || aiModel === 'gemini-2.0-flash' || aiModel === 'gemini-1.5-flash') {
            aiModel = 'gemini-flash-lite-latest';
          }

          let promptToUse = box.templateText || '';
          if (!promptToUse && box.templateId) {
            const matchBox = (cfg.aiBoxes || []).find((b: any) => b.templateId === box.templateId && b.templateText);
            if (matchBox) promptToUse = matchBox.templateText;
          }
          if (!promptToUse && !box.customPrompt) {
            promptToUse = isTextFormat
              ? `Format this real estate listing according to the ${box.title || 'preset'} style. Maintain all property details, price, contact numbers, and formatting clean and attractive.`
              : 'Generate a high-converting Facebook real estate rental listing copy. Highlight investment yield, BTS access, floor, and rental price.';
          }

          const shouldUseCode = (box as any).useGeneratedCode !== false;
          const currentRunListingCode = workflowContextRef.current?.listingCode || initialRunListingCode;

          let effectiveCustomPrompt = box.customPrompt || '';

          if (shouldUseCode && currentRunListingCode) {
            promptToUse = injectListingCodeIntoPrompt(promptToUse, currentRunListingCode, true);
            if (effectiveCustomPrompt) {
              effectiveCustomPrompt = injectListingCodeIntoPrompt(effectiveCustomPrompt, currentRunListingCode, true);
            }
          }

          const aiStart = Date.now();
          try {
            copyText = await requestAIGeneration({
              provider: aiProvider,
              model: aiModel,
              template_id: box.templateId || '',
              template_name: box.title || 'Dynamic Real Estate Copywriter',
              template_text: promptToUse,
              raw_content: upstreamText,
              custom_prompt: effectiveCustomPrompt,
              listing_code: shouldUseCode ? currentRunListingCode : '',
            }, signal);
          } catch (err) {
            if (isRunStopped(myRunId) || branchFatalError) return false;
            console.warn('AI API call threw:', err);
          }

          if (isRunStopped(myRunId) || branchFatalError) return false;

          // If AI response was empty, fall back to formatted upstream text instead of failing the workflow!
          if (!copyText || copyText.trim().length === 0) {
            copyText = upstreamText;
          }

          if (shouldUseCode && currentRunListingCode && copyText) {
            copyText = applyListingCodeToGeneratedText(copyText, currentRunListingCode, true);
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
            branchFatalError = true;
            safeSetExecutionState(myRunId, (prev) => ({
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
            return false;
          }

          generatedOutputsMap[box.id] = copyText;
          workflowContextRef.current.generatedOutputsMap[box.id] = copyText;
          const isCondoNameBox =
            box.title?.toLowerCase().includes('condo') ||
            box.title?.toLowerCase().includes('project name');
          if (isCondoNameBox) {
            const cleanedCondo = extractCleanCondoNameFromAiText(copyText);
            if (cleanedCondo) {
              projName = cleanedCondo;
              workflowContextRef.current.projName = cleanedCondo;
              setProjectName(cleanedCondo);
            }
          } else if (!primaryCopy || isTextFormat) {
            primaryCopy = copyText;
            workflowContextRef.current.primaryCopy = copyText;
          }
          setAiGeneratedOutputs((prev) => ({ ...prev, [box.id]: copyText }));
          if (!isCondoNameBox) {
            setAiGeneratedCopy(copyText);
          }
          await delay(500);
          if (isRunStopped(myRunId) || branchFatalError) return false;
        }

        if (isRunStopped(myRunId) || branchFatalError) return false;

        const completedBranchIds = [
          box.id,
          ...(isExternalBrowser ? [...executedTabGroupIds, ...executedProfileIds] : []),
        ];

        updateBranchNodes(
          completedBranchIds,
          [],
          completedBranchIds,
          `✓ [${box.title || 'Node'}] executed successfully!`
        );
        await delay(250);
        if (isRunStopped(myRunId) || branchFatalError) return false;
        return true;
      };

      const runContentBranch = async () => {
        if (!contentEnabled) return;
        const captionText = await waitForCaptionReady();
        if (isRunStopped(myRunId) || branchFatalError) return;

        const cleanCaption = (captionText || '').trim();
        if (!cleanCaption) {
          // If extracted content is empty, STOP content branch and do not execute next steps
          updateBranchNodes(
            ['get-content'],
            [],
            [],
            '⚠️ No text content found in listing. Skipping content branch steps.',
            { failedNodeIds: ['get-content'] }
          );
          return;
        }

        rawCaption = cleanCaption;
        workflowContextRef.current.rawCaption = cleanCaption;
        setExtractedContent(cleanCaption);

        const hasEnabledContentBox = contentBranchBoxes.some((b) => b.enabled !== false);
        updateBranchNodes(
          ['get-content'],
          [],
          ['get-content'],
          hasEnabledContentBox
            ? '✓ Content extracted — continuing Content branch in parallel...'
            : '✓ Post content extracted!',
          { stepIndex: 3 }
        );

        const contentWaves = buildExecutionWaves(contentBranchBoxes);
        for (const wave of contentWaves) {
          if (isRunStopped(myRunId) || branchFatalError) return;
          if (wave.length > 1) {
            updateBranchNodes(
              [],
              wave.map((b) => b.id),
              [],
              `⚡ Executing ${wave.length} AI format presets in parallel...`
            );
          }
          const results = await Promise.all(wave.map((box) => executeSingleAIBox(box)));
          if (results.some((ok) => !ok) || branchFatalError) return;
        }
      };

      const runImagesBranch = async () => {
        await extractFetchPromise;
        if (isRunStopped(myRunId) || branchFatalError) return;
        if (!imagesEnabled) return;

        if (!imageList || imageList.length === 0) {
          // If extracted images are empty, STOP image branch and do not execute next steps
          updateBranchNodes(
            ['get-images'],
            [],
            [],
            '⚠️ No photos found in listing. Skipping image branch steps.',
            { failedNodeIds: ['get-images'] }
          );
          return;
        }

        setExtractedImages(imageList);
        workflowContextRef.current.imageList = imageList;

        updateBranchNodes(
          ['get-images'],
          [],
          ['get-images'],
          `✓ ${imageList.length} photos extracted & downloaded!`,
          { stepIndex: 3 }
        );

        const imageWaves = buildExecutionWaves(imageBranchBoxes);
        for (const wave of imageWaves) {
          if (isRunStopped(myRunId) || branchFatalError) return;
          if (wave.length > 1) {
            updateBranchNodes(
              [],
              wave.map((b) => b.id),
              [],
              `⚡ Executing ${wave.length} image format steps in parallel...`
            );
          }
          const results = await Promise.all(wave.map((box) => executeSingleAIBox(box)));
          if (results.some((ok) => !ok) || branchFatalError) return;
        }
      };

      await Promise.all([runContentBranch(), runImagesBranch()]);
      if (isRunStopped(myRunId) || branchFatalError) return;

      // Ensure full extract response metadata (propData, projName) has settled
      await extractFetchPromise;
      if (isRunStopped(myRunId) || branchFatalError) return;

      const hasContent = Boolean(rawCaption && rawCaption.trim().length > 0);
      const hasImages = Boolean(imageList && imageList.length > 0);

      // If BOTH content and images are empty: complete stop!
      if (!hasContent && !hasImages) {
        safeSetExecutionState(myRunId, (prev) => ({
          ...prev!,
          isRunning: false,
          hasError: true,
          activeNodeIds: [],
          completedNodeIds: (prev?.completedNodeIds || []).filter((id) => id !== 'get-content' && id !== 'get-images'),
          failedNodeIds: Array.from(new Set([...(prev?.failedNodeIds || []), 'get-content', 'get-images'])),
          currentStepMessage: '❌ No content or images were found in the provided listing. Workflow stopped.',
        }));
        setIsRunningWorkflow(false);
        (window as any).__isWorkflowProcessing = false;
        return;
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
        myRunId,
        signal,
      });
    } finally {
      if (runIdRef.current === myRunId) {
        setIsRunningWorkflow(false);
        (window as any).__isWorkflowProcessing = false;
        (window as any).__workflowConfirmLeave = null;
      }
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
    const ctx = workflowContextRef.current;
    const upstreamParts: string[] = [];
    for (const c of inConns) {
      if (c.fromNodeId === 'get-content') {
        const text = extractedContent || ctx?.rawCaption;
        if (text) upstreamParts.push(text);
      } else {
        const text = aiGeneratedOutputs[c.fromNodeId] || ctx?.generatedOutputsMap[c.fromNodeId];
        if (text) upstreamParts.push(text);
      }
    }

    let upstreamText =
      upstreamParts.filter(Boolean).join('\n\n') ||
      aiGeneratedCopy ||
      ctx?.primaryCopy ||
      extractedContent ||
      ctx?.rawCaption ||
      box.templateText ||
      '';

    if (!upstreamText || upstreamText.trim().length === 0) {
      upstreamText = 'Featured Bangkok Condo for Rent. High-floor modern unit, luxury furniture and appliances, excellent BTS transit access, monthly rental available.';
    }

    const shouldUseCode = (box as any).useGeneratedCode !== false;
    const activeListingCode =
      workflowContextRef.current?.listingCode ||
      generateUniqueListingCode((box as any).codeFormat || (cfg as any)?.codeFormat || 'AAA-######-AA');
    if (workflowContextRef.current && !workflowContextRef.current.listingCode) {
      workflowContextRef.current.listingCode = activeListingCode;
    }

    if (isGoogleSheetBox(box)) {
      let postLink =
        ctx?.targetUrl ||
        runFacebookUrl ||
        (cfg.trigger?.monitoredPageName && /^https?:\/\//i.test(cfg.trigger.monitoredPageName)
          ? cfg.trigger.monitoredPageName
          : '') ||
        (propertyData as any)?.source_url ||
        (propertyData as any)?.url ||
        '';
      if (postLink === 'manual://input') {
        postLink = (cfg.trigger?.monitoredPageName && /^https?:\/\//i.test(cfg.trigger.monitoredPageName) ? cfg.trigger.monitoredPageName : '') || (propertyData as any)?.source_url || '';
      }

      let rawSheetUrl = (box as any).googleSpreadsheetUrl || 'https://docs.google.com/spreadsheets/d/1lzY57D5ers2Xs6cvbV-skeqGSAK_jijbQJZt8Hn8udY/edit?gid=0#gid=0';
      if (rawSheetUrl.includes('https://') && rawSheetUrl.lastIndexOf('https://') > 0) {
        rawSheetUrl = rawSheetUrl.substring(rawSheetUrl.lastIndexOf('https://'));
      }
      const sheetName = (box as any).googleSheetName || '';
      let sheetHeaders = (box as any).googleSheetHeaders || [];
      if (!sheetHeaders || sheetHeaders.length === 0) {
        sheetHeaders = [
          'Code',
          'Project',
          'Room Type',
          'Size',
          'Floor',
          'Price',
          'BTS/MRT',
          'Owner/Agent',
          'Contact Info',
          'Original Link',
        ];
      }
      const customPrompt = (box as any).googleSheetAiPrompt || box.customPrompt || '';
      const condoProjectName = projectName || ctx?.projName || (propertyData as any)?.project_name || 'Featured Property Listing';

      try {
        const syncRes = await fetch('/api/google-sheets/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            spreadsheet_url: rawSheetUrl,
            sheet_name: sheetName,
            headers: sheetHeaders,
            content: upstreamText,
            condo_name: condoProjectName,
            images: (extractedImages || ctx?.imageList || []).map((img: any) => img.stored_url || img.source_url),
            post_url: postLink,
            source_url: postLink,
            link: postLink,
            custom_instructions: customPrompt,
            model: box.model || 'gemini-1.5-flash',
            provider: box.provider || 'google_ai',
            prompt_template: box.templateText || box.customPrompt || (box as any).googleSheetAiPrompt || DEFAULT_GOOGLE_SHEET_PROMPT,
            credentials_json: (box as any).googleServiceAccountJson || '',
            code_format: (box as any).codeFormat || (cfg as any)?.codeFormat || 'AAA-######-AA',
            auto_generate_code: (box as any).autoGenerateCode !== undefined ? (box as any).autoGenerateCode : ((cfg as any)?.autoGenerateCode !== undefined ? (cfg as any).autoGenerateCode : true),
            listing_code: shouldUseCode ? activeListingCode : '',
          }),
        });

        const syncData = await syncRes.json();
        if (!syncRes.ok || !syncData.success) {
          throw new Error(syncData.error || 'Failed to sync with Google Sheets');
        }

        const formattedResult = JSON.stringify(syncData.mapped_data, null, 2);
        setAiGeneratedOutputs((prev) => ({ ...prev, [boxId]: formattedResult }));
        if (workflowContextRef.current) {
          workflowContextRef.current.generatedOutputsMap[boxId] = formattedResult;
          if (!workflowContextRef.current.primaryCopy) workflowContextRef.current.primaryCopy = formattedResult;
        }
        setExecutionState((prev) => {
          const base = prev || {
            isRunning: false,
            isComplete: false,
            hasError: false,
            activeNodeIds: [],
            completedNodeIds: [],
            failedNodeIds: [],
            stepIndex: 4,
            totalSteps: 6,
          };
          const nextFailed = (base.failedNodeIds || []).filter((id) => id !== boxId);
          return {
            ...base,
            failedNodeIds: nextFailed,
            hasError: nextFailed.length > 0,
            completedNodeIds: Array.from(new Set([...(base.completedNodeIds || []), boxId])),
            currentStepMessage: `✓ Row added to Google Sheet [${box.title || 'Google Sheet'}] successfully!`,
          };
        });
        return formattedResult;
      } catch (err: any) {
        console.warn('Google Sheet re-generate sync failed:', err);
        setExecutionState((prev) => {
          const base = prev || {
            isRunning: false,
            isComplete: false,
            hasError: false,
            activeNodeIds: [],
            completedNodeIds: [],
            failedNodeIds: [],
            stepIndex: 4,
            totalSteps: 6,
          };
          return {
            ...base,
            isRunning: false,
            hasError: true,
            activeNodeIds: (base.activeNodeIds || []).filter((id) => id !== boxId),
            failedNodeIds: Array.from(new Set([...(base.failedNodeIds || []), boxId])),
            currentStepMessage: `❌ Google Sheet Sync failed: ${err.message || 'Sync error'}.`,
          };
        });
        throw err;
      }
    }

    const isTextFormat = isTextFormatAIBox(box);
    const aiProvider = box.provider || (box.model?.startsWith('gpt-') ? 'openai' : 'google_ai');
    let aiModel = box.model || (aiProvider === 'openai' ? 'gpt-4o' : 'gemini-flash-lite-latest');
    if (aiModel === 'gemini-2.5-flash' || aiModel === 'gemini-2.0-flash' || aiModel === 'gemini-1.5-flash') {
      aiModel = 'gemini-flash-lite-latest';
    }

    let promptToUse = box.templateText || '';
    if (!promptToUse && box.templateId) {
      const matchBox = (cfg.aiBoxes || []).find((b: any) => b.templateId === box.templateId && b.templateText);
      if (matchBox) promptToUse = matchBox.templateText;
    }
    if (!promptToUse && !box.customPrompt) {
      promptToUse = isTextFormat
        ? `Format this real estate listing according to the ${box.title || 'preset'} style. Maintain all property details, price, contact numbers, and formatting clean and attractive.`
        : 'Generate a high-converting Facebook real estate rental listing copy. Highlight investment yield, BTS access, floor, and rental price.';
    }

    let effectiveCustomPrompt = box.customPrompt || '';

    if (shouldUseCode && activeListingCode) {
      promptToUse = injectListingCodeIntoPrompt(promptToUse, activeListingCode, true);
      if (effectiveCustomPrompt) {
        effectiveCustomPrompt = injectListingCodeIntoPrompt(effectiveCustomPrompt, activeListingCode, true);
      }
    }

    try {
      let generated = await requestAIGeneration({
        provider: aiProvider,
        model: aiModel,
        template_id: box.templateId || '',
        template_name: box.title || 'Dynamic Real Estate Copywriter',
        template_text: promptToUse,
        raw_content: upstreamText,
        custom_prompt: effectiveCustomPrompt,
        listing_code: shouldUseCode ? activeListingCode : '',
      });

      if (!generated || generated.trim().length === 0) {
        generated = upstreamText;
      }

      if (shouldUseCode && activeListingCode && generated) {
        generated = applyListingCodeToGeneratedText(generated, activeListingCode, true);
      }

      if (generated) {
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

    runIdRef.current += 1;
    const myRunId = runIdRef.current;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const signal = controller.signal;

    setIsRunningWorkflow(true);
    isCancelledRef.current = false;
    (window as any).__isWorkflowProcessing = true;

    const updatedFailed = (executionState?.failedNodeIds || []).filter((id) => id !== targetBoxId);
    const updatedCompleted = Array.from(new Set([...(executionState?.completedNodeIds || []), targetBoxId]));

    safeSetExecutionState(myRunId, (prev) => ({
      ...prev!,
      isRunning: true,
      hasError: updatedFailed.length > 0,
      failedNodeIds: updatedFailed,
      completedNodeIds: updatedCompleted,
      activeNodeIds: [],
      currentStepMessage: `▶ Resuming workflow from [${cfg.aiBoxes.find((b) => b.id === targetBoxId)?.title || 'Node'}]...`,
    }));

    const delay = (ms: number) => cancellableDelay(ms, myRunId);

    try {
      const targetIdx = cfg.aiBoxes.findIndex((b) => b.id === targetBoxId);
      const remainingAiBoxes = targetIdx >= 0 ? cfg.aiBoxes.slice(targetIdx + 1) : [];

      for (const nextBox of remainingAiBoxes) {
        if (isRunStopped(myRunId)) return;
        if (!nextBox.enabled || updatedCompleted.includes(nextBox.id)) continue;
        const isWatermark = isWatermarkAIBox(nextBox);
        const isTextFormat = isTextFormatAIBox(nextBox);

        safeSetExecutionState(myRunId, (prev) => ({
          ...prev!,
          activeNodeIds: [nextBox.id],
          currentStepMessage: isWatermark
            ? `✂️ Applying photo crop & frame preset [${nextBox.title || 'Format'}]...`
            : isTextFormat
            ? `📝 Formatting AI copy with [${nextBox.title || 'Format Preset'}]...`
            : `⚡ Generating AI copy with [${nextBox.title || 'AI Model'}]...`,
        }));

        if (isWatermark) {
          if (!ctx.imageList || ctx.imageList.length === 0) {
            console.warn(`Skipping watermark box [${nextBox.title}] because imageList is empty`);
            return;
          }
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
            if (isRunStopped(myRunId)) return;
            const img = ctx.imageList[i];
            const rawUrl = img.stored_url
              ? (img.stored_url.startsWith('http') ? img.stored_url : `http://localhost:8085${img.stored_url}`)
              : img.source_url;
            try {
              const formattedDataUrl = await formatImageWithCropFormat(rawUrl, targetFormat);
              if (isRunStopped(myRunId)) return;
              ctx.localWatermarkedMap[img.index] = formattedDataUrl;
            } catch (err) {
              ctx.localWatermarkedMap[img.index] = rawUrl;
            }
          }
          if (isRunStopped(myRunId)) return;
          setWatermarkedPhotos((prev) => ({ ...prev, ...ctx.localWatermarkedMap }));
          await delay(400);
          if (isRunStopped(myRunId)) return;
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
          const aiModel = nextBox.model || (aiProvider === 'openai' ? 'gpt-4o' : 'gemini-flash-lite-latest');
          try {
            nextCopy = await requestAIGeneration({
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
            }, signal);
          } catch (err) {
            if (isRunStopped(myRunId)) return;
            console.warn('Next AI step threw:', err);
          }

          if (isRunStopped(myRunId)) return;

          if (!nextCopy || nextCopy.trim().length === 0) {
            nextCopy = upstreamText;
          }

          if (!nextCopy || nextCopy.trim().length === 0) {
            safeSetExecutionState(myRunId, (prev) => ({
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
          safeSetExecutionState(myRunId, (prev) => ({
            ...prev!,
            completedNodeIds: Array.from(new Set([...(prev?.completedNodeIds || []), nextBox.id])),
            activeNodeIds: [],
          }));
          await delay(300);
          if (isRunStopped(myRunId)) return;
        }
      }

      if (isRunStopped(myRunId)) return;

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
        myRunId,
        signal,
      });
    } finally {
      if (runIdRef.current === myRunId) {
        setIsRunningWorkflow(false);
        (window as any).__isWorkflowProcessing = false;
        (window as any).__workflowConfirmLeave = null;
      }
    }
  };

  // Run ONLY this specific node / step (does not start workflow from trigger, does not run downstream steps)
  const handleRunFromStep = async (nodeId: string) => {
    if (isRunningWorkflow || !editingFormat?.config) return;
    const cfg = editingFormat.config;

    // 1. If clicking trigger:
    if (nodeId === 'trigger') {
      const isManual = cfg.trigger?.sourceMode === 'manual';
      if (isManual) {
        executeCanvasWorkflow('');
        return;
      }
      const url = (runFacebookUrl || workflowContextRef.current?.targetUrl || '').trim();
      if (url) {
        executeCanvasWorkflow(url);
      } else {
        setRunFacebookUrl('');
        setIsRunModalOpen(true);
      }
      return;
    }

    // 2. If running an AI Box (Format Preset, AI Model, Prompt Generator, Chrome Tab Group, etc.):
    const targetBox = cfg.aiBoxes?.find((b) => b.id === nodeId);
    if (targetBox) {
      // 2a. Chrome Tab Group node execution
      if (isChromeTabGroupAIBox(targetBox) || (targetBox as any).processType === 'chrome_tab_group') {
        const areBoxesConnected = (idA: string, idB: string) =>
          (cfg.connections || []).some(
            (c: any) => (c.fromNodeId === idA && c.toNodeId === idB) || (c.fromNodeId === idB && c.toNodeId === idA)
          );
        const connectedProfile = (cfg.aiBoxes || []).find(
          (b: any) => areBoxesConnected(targetBox.id, b.id) && (isChromeProfileAIBox(b) || (b as any).processType === 'chrome_profile')
        );
        const profId = connectedProfile?.browserProfileId || (targetBox as any).browserProfileId;
        const profKey = connectedProfile?.browserProfileKey || connectedProfile?.browserProfileName || (targetBox as any).browserProfileKey || 'Profile 2';
        const groupName = targetBox.browserGroupName || targetBox.title || 'Enhance IMG';
        const propId = workflowContextRef.current?.propData?.id || propertyData?.id || `PROP-${Date.now()}`;
        const imgs = extractedImages.length > 0 ? extractedImages : (workflowContextRef.current?.imageList || []);

        if (imgs.length === 0 && !targetBox.title?.toLowerCase().includes('hero') && (targetBox as any).tabGroupMode !== 'generate') {
          setExecutionState((prev) => ({
            ...(prev || { completedNodeIds: [], failedNodeIds: [], hasError: false }),
            isRunning: false,
            activeNodeIds: [],
            failedNodeIds: [nodeId],
            hasError: true,
            currentStepMessage: `❌ No photos found to process for [${groupName}]. Please extract photos first.`,
          }));
          return;
        }

        setExecutionState((prev) => ({
          ...(prev || { completedNodeIds: [], failedNodeIds: [], hasError: false }),
          isRunning: true,
          activeNodeIds: [nodeId],
          currentStepMessage: `Executing Tab Group [${groupName}] across Chrome tabs...`,
        }));

        try {
          await openBrowserProfile(profId, profKey).catch(() => {});
          await focusBrowserTabGroup({
            profileId: profId,
            profileKey: profKey,
            groupName: groupName,
            groupTabUrls: targetBox.browserGroupTabUrls || [],
            tabMode: (targetBox as any).workerTabMode || 'existing_tabs',
            workerCount: (targetBox as any).workerTabCount || 4,
            reuseSessionTabs: (targetBox as any).reuseSessionTabs ?? true,
            force: true,
          }).catch(() => {});

          const promptToUse = resolvePromptForBrowserNode(targetBox, {
            title: projectName || propertyData?.title || 'Featured Property Listing',
            width: (targetBox as any).outputWidth || 1080,
            height: (targetBox as any).outputHeight || 1350,
          });

          const queueImgs = imgs.map((img, i) => ({
            index: i + 1,
            original_position: i + 1,
            source_url: img.source_url || img.stored_url,
            stored_url: img.stored_url || img.source_url,
            width: (targetBox as any).outputWidth || 1080,
            height: (targetBox as any).outputHeight || 1350,
            resolved_prompt: promptToUse,
          }));

          let createdJobs: any[] = [];
          if (queueImgs.length > 0) {
            createdJobs = await createBatchImageQueue({
              property_id: propId,
              property_name: projectName || propertyData?.title || 'Featured Property Listing',
              prompt_template_text: promptToUse,
              images: queueImgs,
              lane_id: 'lane-1',
              output_width: (targetBox as any).outputWidth || 1080,
              output_height: (targetBox as any).outputHeight || 1350,
            }).catch(() => []);
            await startImageQueue(propId).catch(() => {});
          }

          await startAutomation({
            property_id: propId,
            profile_key: profKey,
            group_name: groupName,
            group_tab_urls: targetBox.browserGroupTabUrls || [],
            tab_ids: [1, 2, 3, 4],
            tab_mode: (targetBox as any).workerTabMode || 'existing_tabs',
            worker_count: (targetBox as any).workerTabCount || 4,
            reuse_session_tabs: (targetBox as any).reuseSessionTabs ?? true,
            jobs: createdJobs,
          });

          setExecutionState((prev) => ({
            ...(prev || { completedNodeIds: [], failedNodeIds: [], hasError: false }),
            isRunning: false,
            activeNodeIds: [],
            completedNodeIds: Array.from(new Set([...(prev?.completedNodeIds || []), nodeId])),
            currentStepMessage: `✓ Finished running Tab Group [${groupName}]`,
          }));
        } catch (err: any) {
          console.warn('Error running tab group step:', err);
          setExecutionState((prev) => ({
            ...(prev || { completedNodeIds: [], failedNodeIds: [], hasError: false }),
            isRunning: false,
            activeNodeIds: [],
            failedNodeIds: Array.from(new Set([...(prev?.failedNodeIds || []), nodeId])),
            hasError: true,
            currentStepMessage: `❌ Failed running Tab Group [${groupName}]`,
          }));
        }
        return;
      }

      setExecutionState((prev) => ({
        ...(prev || { completedNodeIds: [], failedNodeIds: [], hasError: false }),
        isRunning: true,
        activeNodeIds: [nodeId],
        currentStepMessage: `Executing step [${targetBox.title || 'Node'}]...`,
      }));

      try {
        if (!isWatermarkAIBox(targetBox) && !isExternalBrowserAIBox(targetBox)) {
          await handleRegenerateBoxOutput(nodeId);
        }
        setExecutionState((prev) => ({
          ...(prev || { completedNodeIds: [], failedNodeIds: [], hasError: false }),
          isRunning: false,
          activeNodeIds: [],
          completedNodeIds: Array.from(new Set([...(prev?.completedNodeIds || []), nodeId])),
          currentStepMessage: `✓ Finished running step [${targetBox.title || 'Node'}]`,
        }));
      } catch (err) {
        console.warn('Error running single step:', err);
        setExecutionState((prev) => ({
          ...(prev || { completedNodeIds: [], failedNodeIds: [], hasError: false }),
          isRunning: false,
          activeNodeIds: [],
          failedNodeIds: Array.from(new Set([...(prev?.failedNodeIds || []), nodeId])),
          hasError: true,
          currentStepMessage: `❌ Failed running step [${targetBox.title || 'Node'}]`,
        }));
      }
      return;
    }

    // 3. If get-content:
    if (nodeId === 'get-content') {
      if (cfg.trigger?.sourceMode === 'manual') {
        const manualCap = cfg.trigger.manualContent || '';
        setExtractedContent(manualCap);
        if (workflowContextRef.current) workflowContextRef.current.rawCaption = manualCap;
        setExecutionState((prev) => ({
          ...(prev || { completedNodeIds: [], failedNodeIds: [], hasError: false }),
          isRunning: false,
          activeNodeIds: [],
          completedNodeIds: Array.from(new Set([...(prev?.completedNodeIds || []), 'get-content'])),
          currentStepMessage: '✓ Content loaded from manual input!',
        }));
        return;
      }
      const url = (runFacebookUrl || workflowContextRef.current?.targetUrl || '').trim();
      if (url) {
        setExecutionState((prev) => ({
          ...(prev || { completedNodeIds: [], failedNodeIds: [], hasError: false }),
          isRunning: true,
          activeNodeIds: ['get-content'],
          currentStepMessage: 'Extracting content only...',
        }));
        try {
          const resp = await fetch('/api/facebook-import/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, max_images: 25 }),
          });
          if (resp.ok) {
            const data = await resp.json();
            const cap = (data.result?.caption?.original || data.raw_content || data.caption || '').trim();
            if (cap) {
              setExtractedContent(cap);
              if (workflowContextRef.current) workflowContextRef.current.rawCaption = cap;
              setExecutionState((prev) => ({
                ...(prev || { completedNodeIds: [], failedNodeIds: [], hasError: false }),
                isRunning: false,
                activeNodeIds: [],
                completedNodeIds: Array.from(new Set([...(prev?.completedNodeIds || []), 'get-content'])),
                currentStepMessage: '✓ Content extracted successfully!',
              }));
              return;
            }
          }
          setExecutionState((prev) => ({
            ...(prev || { completedNodeIds: [], failedNodeIds: [], hasError: false }),
            isRunning: false,
            activeNodeIds: [],
            failedNodeIds: ['get-content'],
            hasError: true,
            currentStepMessage: '⚠️ No content found in post.',
          }));
        } catch (e) {
          setExecutionState((prev) => ({
            ...(prev || { completedNodeIds: [], failedNodeIds: [], hasError: false }),
            isRunning: false,
            activeNodeIds: [],
            failedNodeIds: ['get-content'],
            hasError: true,
            currentStepMessage: '❌ Failed extracting content.',
          }));
        }
      } else {
        setRunFacebookUrl('');
        setIsRunModalOpen(true);
      }
      return;
    }

    // 4. If get-images:
    if (nodeId === 'get-images') {
      if (cfg.trigger?.sourceMode === 'manual') {
        const manualImgs = (cfg.trigger.manualImages || []).map((img, idx) => ({
          index: idx,
          facebook_photo_id: `manual-photo-${idx + 1}`,
          source_url: img.url,
          stored_url: img.url,
          filename: img.filename || `Photo #${idx + 1}`,
          status: 'verified',
        }));
        setExtractedImages(manualImgs);
        if (workflowContextRef.current) workflowContextRef.current.imageList = manualImgs;
        setExecutionState((prev) => ({
          ...(prev || { completedNodeIds: [], failedNodeIds: [], hasError: false }),
          isRunning: false,
          activeNodeIds: [],
          completedNodeIds: Array.from(new Set([...(prev?.completedNodeIds || []), 'get-images'])),
          currentStepMessage: `✓ ${manualImgs.length} manual photos ready!`,
        }));
        return;
      }
      const url = (runFacebookUrl || workflowContextRef.current?.targetUrl || '').trim();
      if (url) {
        setExecutionState((prev) => ({
          ...(prev || { completedNodeIds: [], failedNodeIds: [], hasError: false }),
          isRunning: true,
          activeNodeIds: ['get-images'],
          currentStepMessage: 'Extracting images only...',
        }));
        try {
          const resp = await fetch('/api/facebook-import/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, max_images: 25 }),
          });
          if (resp.ok) {
            const data = await resp.json();
            const rawImgs = data.result?.images || data.images || [];
            if (rawImgs.length > 0) {
              const imgs = rawImgs.map((img: any, idx: number) => ({
                index: idx,
                facebook_photo_id: img.facebook_photo_id,
                source_url: img.source_url,
                stored_url: img.stored_url,
                status: img.status || 'verified',
                width: img.width,
                height: img.height,
              }));
              setExtractedImages(imgs);
              if (workflowContextRef.current) workflowContextRef.current.imageList = imgs;
              setExecutionState((prev) => ({
                ...(prev || { completedNodeIds: [], failedNodeIds: [], hasError: false }),
                isRunning: false,
                activeNodeIds: [],
                completedNodeIds: Array.from(new Set([...(prev?.completedNodeIds || []), 'get-images'])),
                currentStepMessage: `✓ ${imgs.length} photos extracted!`,
              }));
              return;
            }
          }
          setExecutionState((prev) => ({
            ...(prev || { completedNodeIds: [], failedNodeIds: [], hasError: false }),
            isRunning: false,
            activeNodeIds: [],
            failedNodeIds: ['get-images'],
            hasError: true,
            currentStepMessage: '⚠️ No photos found in post.',
          }));
        } catch (e) {
          setExecutionState((prev) => ({
            ...(prev || { completedNodeIds: [], failedNodeIds: [], hasError: false }),
            isRunning: false,
            activeNodeIds: [],
            failedNodeIds: ['get-images'],
            hasError: true,
            currentStepMessage: '❌ Failed extracting images.',
          }));
        }
      } else {
        setRunFacebookUrl('');
        setIsRunModalOpen(true);
      }
      return;
    }
  };

  // Run Workflow with Facebook Link or Manual Input - Executes directly on Canvas!
  const handleConfirmRun = async () => {
    const isManual = editingFormat?.config?.trigger?.sourceMode === 'manual';
    const url = runFacebookUrl.trim();
    if (!isManual && !url) return;
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
    await executeCanvasWorkflow(isManual ? '' : url);
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
                height: '32px',
                padding: '0 6px 0 4px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                borderRadius: '6px',
                backgroundColor: isDark ? '#21262D' : '#F1F5F9',
                border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                boxSizing: 'border-box',
              }}
            >
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '5px',
                  backgroundColor: isDark ? 'rgba(139, 92, 246, 0.18)' : 'rgba(139, 92, 246, 0.12)',
                  color: isDark ? '#A78BFA' : '#7C3AED',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '13px',
                  flexShrink: 0,
                }}
              >
                <FiGitBranch />
              </div>
              <input
                type="text"
                value={modalFormatName}
                onChange={(e) => handleFormatNameChange(e.target.value)}
                onBlur={handleFormatNameCommit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                placeholder="Format Name"
                title="Click to rename workflow"
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  padding: '2px 4px',
                  outline: 'none',
                  minWidth: '180px',
                  maxWidth: '320px',
                  transition: 'all 0.15s ease',
                }}
              />
              <button
                type="button"
                onClick={(e) => {
                  const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                  if (input) input.focus();
                }}
                title="Rename workflow"
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px',
                  borderRadius: '4px',
                  opacity: 0.7,
                }}
              >
                <FiEdit2 size={12} />
              </button>
            </div>
          </div>,
          headerTitleEl
        )}

      {/* Portal: Run & Reset Layout Buttons into Navbar Right Corner (Same size, simple, zero glow) */}
      {headerActionEl &&
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

            {/* Clear Data & Results Button */}
            {(Boolean(executionState && (executionState.completedNodeIds?.length || 0) > 0) ||
              extractedImages.length > 0 ||
              Boolean(extractedContent && extractedContent.trim().length > 0) ||
              Object.keys(aiGeneratedOutputs).length > 0 ||
              Object.keys(watermarkedPhotos).length > 0 ||
              Object.keys(enhancedPhotos).length > 0) && (
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(true)}
                title="Clear all extracted post data and execution results"
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
                  backgroundColor: isDark ? '#21262D' : '#F1F5F9',
                  color: isDark ? '#F87171' : '#DC2626',
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
                  e.currentTarget.style.backgroundColor = isDark ? '#30363D' : '#FEE2E2';
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
                <FiTrash2 size={12} style={{ color: isDark ? '#F87171' : '#DC2626' }} />
                <span>Clear</span>
              </button>
            )}
          </div>,
          headerActionEl
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
            rawContent={extractedContent || (editingFormat.config.trigger.sourceMode === 'manual' ? (editingFormat.config.trigger.manualContent || '') : '')}
            images={
              extractedImages.length > 0
                ? extractedImages
                : (editingFormat.config.trigger.sourceMode === 'manual' && editingFormat.config.trigger.manualImages?.length)
                ? editingFormat.config.trigger.manualImages.map((img, idx) => ({
                    index: idx,
                    facebook_photo_id: `manual-photo-${idx + 1}`,
                    source_url: img.url,
                    stored_url: img.url,
                    filename: img.filename || `Photo #${idx + 1}`,
                    status: 'verified',
                  }))
                : []
            }
            watermarkedPhotos={watermarkedPhotos}
            enhancedPhotos={enhancedPhotos}
            aiGeneratedOutputs={aiGeneratedOutputs}
            aiGeneratedCopy={aiGeneratedCopy}
            projectName={projectName}
            onUpdateBoxOutput={handleUpdateBoxOutput}
            onRegenerateBoxOutput={handleRegenerateBoxOutput}
            onContinueWorkflow={handleContinueWorkflow}
            onRunFromStep={handleRunFromStep}
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
      ) : (() => {
        const pinnedFormats = formats.filter((f) => Boolean(f.isPinned));
        const unpinnedFormats = formats.filter((f) => !f.isPinned);

        const renderFormatCard = (format: WorkflowFormat) => {
          const isActive = format.id === activeFormatId;
          const isPinned = Boolean(format.isPinned);

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
              {/* Card Top: Title, Active Badge & Pin Button */}
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
                  <div style={{ minWidth: 0, flex: 1 }}>
                    {inlineRenamingId === format.id ? (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <input
                          type="text"
                          autoFocus
                          value={inlineRenamingName}
                          onChange={(e) => setInlineRenamingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveInlineRename(format.id);
                            if (e.key === 'Escape') setInlineRenamingId(null);
                          }}
                          onBlur={() => handleSaveInlineRename(format.id)}
                          style={{
                            fontSize: '0.9375rem',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            backgroundColor: isDark ? '#161B22' : '#FFFFFF',
                            border: '1px solid #3B82F6',
                            borderRadius: '4px',
                            padding: '2px 6px',
                            width: '100%',
                            outline: 'none',
                          }}
                        />
                      </div>
                    ) : (
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        title="Double-click to rename"
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setInlineRenamingId(format.id);
                          setInlineRenamingName(format.name);
                        }}
                      >
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
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setInlineRenamingId(format.id);
                            setInlineRenamingName(format.name);
                          }}
                          title="Rename workflow"
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '2px',
                            borderRadius: '4px',
                            opacity: 0.6,
                            transition: 'opacity 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.opacity = '1';
                            e.currentTarget.style.color = 'var(--text-primary)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.opacity = '0.6';
                            e.currentTarget.style.color = 'var(--text-muted)';
                          }}
                        >
                          <FiEdit2 size={12} />
                        </button>
                      </div>
                    )}
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Updated {new Date(format.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>
                  {isActive && (
                    <Badge variant="info" size="sm">
                      <FiCheckCircle style={{ marginRight: '3px' }} /> Active in FB Import
                    </Badge>
                  )}

                  {/* Pin Toggle Button */}
                  <button
                    type="button"
                    onClick={(e) => handleTogglePinFormat(format.id, e)}
                    title={isPinned ? 'Unpin workflow from first row' : 'Pin workflow to first row'}
                    style={{
                      height: '28px',
                      width: '28px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '0.375rem',
                      backgroundColor: isPinned
                        ? 'rgba(59, 130, 246, 0.15)'
                        : isDark
                        ? 'rgba(255, 255, 255, 0.04)'
                        : 'rgba(0, 0, 0, 0.03)',
                      border: isPinned
                        ? '1px solid rgba(59, 130, 246, 0.45)'
                        : '1px solid var(--border-color)',
                      color: isPinned ? (isDark ? '#60A5FA' : '#2563EB') : 'var(--text-muted)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = isPinned
                        ? 'rgba(59, 130, 246, 0.25)'
                        : isDark
                        ? 'rgba(255, 255, 255, 0.08)'
                        : 'rgba(0, 0, 0, 0.06)';
                      e.currentTarget.style.color = isPinned
                        ? (isDark ? '#60A5FA' : '#2563EB')
                        : 'var(--text-primary)';
                      e.currentTarget.style.borderColor = isPinned
                        ? 'rgba(59, 130, 246, 0.7)'
                        : 'var(--border-color-hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = isPinned
                        ? 'rgba(59, 130, 246, 0.15)'
                        : isDark
                        ? 'rgba(255, 255, 255, 0.04)'
                        : 'rgba(0, 0, 0, 0.03)';
                      e.currentTarget.style.color = isPinned
                        ? (isDark ? '#60A5FA' : '#2563EB')
                        : 'var(--text-muted)';
                      e.currentTarget.style.borderColor = isPinned
                        ? 'rgba(59, 130, 246, 0.45)'
                        : 'var(--border-color)';
                    }}
                  >
                    {isPinned ? (
                      <BsPinAngleFill style={{ fontSize: '13px' }} />
                    ) : (
                      <BsPinAngle style={{ fontSize: '13px' }} />
                    )}
                  </button>
                </div>
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
        };

        return (
          /* WORKFLOW FORMAT CARDS: PINNED FIRST ROW + UNDER ROW WITH SEPARATION GAP */
          pinnedFormats.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {/* First Row: Just Only Show Pinned Card */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
                  gap: '1.25rem',
                }}
              >
                {pinnedFormats.map(renderFormatCard)}
              </div>

              {/* Generous Gap Between First Row (Pin Row) and Under Row */}
              <div style={{ height: '2.5rem' }} />

              {/* Under Row: Remaining Unpinned Cards */}
              {unpinnedFormats.length > 0 && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
                    gap: '1.25rem',
                  }}
                >
                  {unpinnedFormats.map(renderFormatCard)}
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
                gap: '1.25rem',
              }}
            >
              {formats.map(renderFormatCard)}
            </div>
          )
        );
      })()}

        </>
      )}

      {/* Run Workflow Facebook Link Prompt Modal */}
      {isRunModalOpen && (
        <Modal
          isOpen={isRunModalOpen}
          onClose={() => setIsRunModalOpen(false)}
          title={editingFormat?.config?.trigger?.sourceMode === 'manual' ? 'Run Manual Workflow' : 'Run Workflow'}
          maxWidth={editingFormat?.config?.trigger?.sourceMode === 'manual' ? '920px' : '520px'}
        >
          {editingFormat?.config?.trigger?.sourceMode === 'manual' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.25rem 0' }}>
              {/* Header Banner */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(16, 185, 129, 0.12)',
                    color: '#10B981',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem',
                    flexShrink: 0,
                  }}
                >
                  <FiEdit3 />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Run with Manual Input
                  </h4>
                  <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    Execute this workflow using your manually entered property description and uploaded photos.
                  </p>
                </div>
              </div>

              {/* Two-Column Symmetrical Layout: Left Column (Textarea), Right Column (Images) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '1.25rem',
                  alignItems: 'start',
                }}
              >
                {/* Left Column: Property Description / Content */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '24px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Property Description / Content
                    </label>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                      {(editingFormat.config.trigger.manualContent || '').length} characters
                    </span>
                  </div>
                  <textarea
                    value={editingFormat.config.trigger.manualContent || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      const updatedCfg = {
                        ...editingFormat.config,
                        trigger: {
                          ...editingFormat.config.trigger,
                          manualContent: val,
                        },
                      };
                      handleCanvasConfigChange(updatedCfg);
                    }}
                    placeholder="Paste or edit property description, room specs, rent price, location..."
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      height: '380px',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      fontSize: '0.8125rem',
                      lineHeight: 1.5,
                      resize: 'none',
                      outline: 'none',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>

                {/* Right Column: Upload Listing Photos & Grid Container */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  {/* Symmetrical Top Header for Right Column */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FiImage size={14} color="#10B981" />
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Listing Photos
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          padding: '1px 7px',
                          borderRadius: '10px',
                          backgroundColor:
                            (editingFormat.config.trigger.manualImages?.length || 0) > 0
                              ? 'rgba(16, 185, 129, 0.15)'
                              : 'rgba(255,255,255,0.06)',
                          color:
                            (editingFormat.config.trigger.manualImages?.length || 0) > 0
                              ? '#10B981'
                              : 'var(--text-muted)',
                        }}
                      >
                        {editingFormat.config.trigger.manualImages?.length || 0} Photos
                      </span>
                      {(editingFormat.config.trigger.manualImages?.length || 0) > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            handleCanvasConfigChange({
                              ...editingFormat.config,
                              trigger: {
                                ...editingFormat.config.trigger,
                                manualImages: [],
                              },
                            });
                          }}
                          title="Clear all photos"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#EF4444',
                            fontSize: '0.6875rem',
                            cursor: 'pointer',
                            padding: 0,
                            fontWeight: 500,
                          }}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Matching Height Container for Images Box */}
                  <div
                    style={{
                      height: '380px',
                      boxSizing: 'border-box',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.65rem',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-color)',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Hidden File Input for Modal */}
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      id="manual-run-modal-images-input"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const files = e.target.files;
                        if (!files || files.length === 0) return;
                        const readPromises = Array.from(files).map((file) => {
                          return new Promise<{ url: string; filename: string; mime_type: string; size_bytes: number }>((resolve) => {
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              resolve({
                                url: ev.target?.result as string,
                                filename: file.name,
                                mime_type: file.type || 'image/jpeg',
                                size_bytes: file.size,
                              });
                            };
                            reader.readAsDataURL(file);
                          });
                        });
                        Promise.all(readPromises).then((newImgs) => {
                          const existing = editingFormat.config.trigger.manualImages || [];
                          handleCanvasConfigChange({
                            ...editingFormat.config,
                            trigger: {
                              ...editingFormat.config.trigger,
                              manualImages: [...existing, ...newImgs],
                            },
                          });
                          e.target.value = '';
                        });
                      }}
                    />

                    {/* Compact Upload Dropzone Header Bar */}
                    <label
                      htmlFor="manual-run-modal-images-input"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        border: '1.5px dashed var(--border-color)',
                        backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        flexShrink: 0,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#10B981';
                        e.currentTarget.style.backgroundColor = isDark ? 'rgba(16, 185, 129, 0.05)' : '#F0FDF4';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                        e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC';
                      }}
                    >
                      <FiUploadCloud size={17} color="#10B981" />
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Click to Upload Listing Photos
                      </span>
                      <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                        · JPG, PNG, WEBP
                      </span>
                    </label>

                    {/* Scrollable Photos Preview Grid with Clean Boundaries */}
                    {(editingFormat.config.trigger.manualImages || []).length > 0 ? (
                      <div
                        style={{
                          flex: 1,
                          minHeight: 0,
                          overflowY: 'auto',
                          display: 'grid',
                          gridTemplateColumns: 'repeat(4, 1fr)',
                          gridAutoRows: 'max-content',
                          gap: '6px',
                          paddingRight: '3px',
                          paddingBottom: '8px',
                        }}
                      >
                        {(editingFormat.config.trigger.manualImages || []).map((img, idx) => (
                          <div
                            key={idx}
                            style={{
                              position: 'relative',
                              borderRadius: '6px',
                              overflow: 'hidden',
                              aspectRatio: '1',
                              border: '1px solid var(--border-color)',
                              backgroundColor: isDark ? '#000000' : '#E2E8F0',
                            }}
                          >
                            <img
                              src={img.url}
                              alt={img.filename || `Photo ${idx + 1}`}
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            />
                            <span
                              style={{
                                position: 'absolute',
                                top: '3px',
                                left: '3px',
                                fontSize: '0.5rem',
                                fontWeight: 700,
                                padding: '1px 4px',
                                borderRadius: '3px',
                                backgroundColor: 'rgba(0,0,0,0.65)',
                                color: '#FFFFFF',
                              }}
                            >
                              #{idx + 1}
                            </span>
                            <button
                              type="button"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                const updated = (editingFormat.config.trigger.manualImages || []).filter((_, i) => i !== idx);
                                handleCanvasConfigChange({
                                  ...editingFormat.config,
                                  trigger: {
                                    ...editingFormat.config.trigger,
                                    manualImages: updated,
                                  },
                                });
                              }}
                              title="Remove photo"
                              style={{
                                position: 'absolute',
                                top: '3px',
                                right: '3px',
                                width: '18px',
                                height: '18px',
                                borderRadius: '50%',
                                backgroundColor: 'rgba(0,0,0,0.7)',
                                color: '#FFFFFF',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: 0,
                              }}
                            >
                              <FiX size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div
                        style={{
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          color: 'var(--text-muted)',
                          fontSize: '0.75rem',
                          textAlign: 'center',
                          padding: '1rem',
                        }}
                      >
                        <FiImage size={24} style={{ opacity: 0.35 }} />
                        <span>No photos uploaded yet</span>
                        <span style={{ fontSize: '0.6875rem', opacity: 0.65 }}>
                          Click above to select multiple photos
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal footer buttons */}
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
                  leftIcon={<FiPlay style={{ fill: 'currentColor' }} />}
                  style={{
                    backgroundColor: '#10B981',
                    borderColor: '#10B981',
                    color: '#FFFFFF',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Run Workflow
                </Button>
              </div>
            </div>
          ) : (
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
          )}
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

      {/* Clear Canvas Data & Results Confirmation Modal */}
      {showClearConfirmModal && (
        <Modal
          isOpen={showClearConfirmModal}
          onClose={() => setShowClearConfirmModal(false)}
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <div
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isDark ? '#F87171' : '#DC2626',
                  flexShrink: 0,
                }}
              >
                <FiTrash2 size={15} />
              </div>
              <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                Clear Canvas Data & Results?
              </span>
            </div>
          }
          maxWidth="460px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.25rem 0' }}>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Are you sure you want to clear all extracted post content, property photos, AI generated outputs, and execution results from the canvas? This will reset all nodes back to their ready state.
            </p>

            <div
              style={{
                fontSize: '0.75rem',
                color: isDark ? '#10B981' : '#059669',
                backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.08)',
                padding: '0.625rem 0.75rem',
                borderRadius: '0.5rem',
                border: isDark ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(16, 185, 129, 0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <FiCheckCircle size={15} style={{ flexShrink: 0 }} />
              <span>Your workflow structure, prompt presets, browser profiles, and connections will remain untouched.</span>
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
                onClick={() => setShowClearConfirmModal(false)}
                style={{ fontWeight: 600 }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  handleClearRunData();
                  setShowClearConfirmModal(false);
                }}
                leftIcon={<FiTrash2 size={13} />}
                style={{
                  backgroundColor: '#DC2626',
                  borderColor: '#DC2626',
                  color: '#FFFFFF',
                  fontWeight: 600,
                }}
              >
                Confirm Clear
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
