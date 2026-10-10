import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { DynamicAIBoxConfig, CanvasPromptOption } from './FacebookWorkflowCanvas';
import { RunwareIcon, LaoZhangIcon, OpenAIIcon } from './AITrainingChatbot';
import { Select } from '../../components/ui/Select';
import { useTheme } from '../../context/ThemeContext';
import { getAIModelDisplayName, isImagePrompt } from './aiModelUtils';
import { HiSparkles } from 'react-icons/hi2';
import { BsPinAngle, BsPinAngleFill } from 'react-icons/bs';
import {
  FiArrowUp,
  FiCopy,
  FiCheck,
  FiX,
  FiSliders,
  FiTrash2,
  FiImage,
  FiDownload,
  FiEye,
  FiEyeOff,
  FiRefreshCw,
  FiFileText,
  FiPlus,
  FiChevronDown,
  FiChevronRight,
  FiMoreHorizontal,
  FiEdit2,
  FiMessageSquare,
  FiSettings,
  FiSidebar,
  FiMaximize2,
  FiZoomIn,
  FiZoomOut,
} from 'react-icons/fi';

export interface ImportedPostImage {
  index: number;
  source_url: string;
  stored_url?: string;
}

export interface AttachedPhotoItem {
  url: string;
  photoIndex?: number;
  index?: number;
  name?: string;
}

export interface EnhancedPhotoItem {
  originalUrl: string;
  enhancedUrl: string;
  photoIndex?: number;
  name?: string;
  durationMs?: number;
}

export interface LightboxModalState {
  isOpen: boolean;
  enhancedUrl: string;
  originalUrl?: string;
  photoIndex?: number;
  name?: string;
  promptInstructions?: string;
  isOriginalActive?: boolean;
}

export interface AIImageStudioProps {
  box: DynamicAIBoxConfig;
  availablePrompts?: CanvasPromptOption[];
  importedPhotos?: ImportedPostImage[];
  enhancedPhotosMap?: Record<number, string>;
  onPhotoEnhanced?: (photoIndex: number, enhancedUrl: string) => void;
  isSettingsOpen?: boolean;
  onCloseSettings?: () => void;
  onUpdateBox: (id: string, updates: Partial<DynamicAIBoxConfig>) => void;
  onToggleBox?: (id: string) => void;
  onDuplicateBox?: (box: DynamicAIBoxConfig) => void;
  onDeleteBox?: (id: string) => void;
  onClose?: () => void;
  startWithNewChat?: boolean;
  initialAttachedImages?: AttachedPhotoItem[];
}

export interface ImageChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  originalImageUrl?: string;
  originalImages?: AttachedPhotoItem[];
  enhancedImageUrl?: string;
  enhancedImages?: EnhancedPhotoItem[];
  durationMs?: number;
  model?: string;
  isPromptProposal?: boolean;
  proposedPrompt?: string;
  photoIndex?: number;
  isPending?: boolean;
  pendingTotalCount?: number;
  pendingDoneCount?: number;
  promptInstructions?: string;
  strength?: number;
}

export interface StudioChatSession {
  id: string;
  title: string;
  isPinned?: boolean;
  createdAt: number;
  updatedAt: number;
  messages: ImageChatMessage[];
  inputValue?: string;
  attachedImage?: string | null;
  attachedImageIndex?: number | null;
  attachedImageName?: string;
  attachedImages?: AttachedPhotoItem[];
}

const DEFAULT_SAMPLE_PHOTO =
  'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80';

const loadSessionsFromStorage = (boxId: string): StudioChatSession[] => {
  const sessionsKey = `ea_image_studio_sessions_${boxId || 'default'}`;
  const legacyKey = `ea_image_studio_chat_${boxId || 'default'}`;
  try {
    const rawSessions = localStorage.getItem(sessionsKey);
    if (rawSessions) {
      const parsed = JSON.parse(rawSessions);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Keep at most 1 empty unpinned chat so recents list stays clean
        let seenEmpty = false;
        const cleaned = parsed.filter((s: StudioChatSession) => {
          const isEmpty = (!s.messages || s.messages.length === 0) && !s.attachedImage && !s.isPinned;
          if (isEmpty) {
            if (seenEmpty) return false;
            seenEmpty = true;
          }
          return true;
        });
        return cleaned.length > 0 ? cleaned : parsed;
      }
    }
    const rawLegacy = localStorage.getItem(legacyKey);
    if (rawLegacy) {
      const legacy = JSON.parse(rawLegacy);
      if (Array.isArray(legacy.messages) && legacy.messages.length > 0) {
        const firstUser = legacy.messages.find((m: any) => m.role === 'user');
        const autoTitle = firstUser?.content ? firstUser.content.slice(0, 26).trim() : 'Property Enhancement';
        const migrated: StudioChatSession = {
          id: `session_${Date.now()}`,
          title: autoTitle || 'Property Enhancement',
          createdAt: legacy.savedAt || Date.now(),
          updatedAt: legacy.savedAt || Date.now(),
          messages: legacy.messages,
          inputValue: legacy.inputValue || '',
          attachedImage: legacy.attachedImage || null,
          attachedImageIndex: legacy.attachedImageIndex ?? null,
          attachedImageName: legacy.attachedImageName || '',
        };
        localStorage.setItem(sessionsKey, JSON.stringify([migrated]));
        return [migrated];
      }
    }
  } catch (err) {
    console.warn('Failed to load studio sessions', err);
  }
  return [
    {
      id: `session_${Date.now()}`,
      title: 'New chat',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
      inputValue: '',
      attachedImage: null,
      attachedImageIndex: null,
      attachedImageName: '',
    },
  ];
};

const saveSessionsToStorage = (boxId: string, sessions: StudioChatSession[]) => {
  const sessionsKey = `ea_image_studio_sessions_${boxId || 'default'}`;
  try {
    localStorage.setItem(sessionsKey, JSON.stringify(sessions));
  } catch (e) {
    try {
      const sanitized = sessions.map((s, idx) => {
        if (idx > 2) {
          return {
            ...s,
            attachedImage: null,
            messages: s.messages.map((m) => ({
              ...m,
              originalImageUrl: m.originalImageUrl?.startsWith('data:') && m.originalImageUrl.length > 100000 ? undefined : m.originalImageUrl,
            })),
          };
        }
        return s;
      });
      localStorage.setItem(sessionsKey, JSON.stringify(sanitized));
    } catch {}
  }
};

export const AIImageStudio: React.FC<AIImageStudioProps> = ({
  box,
  availablePrompts = [],
  importedPhotos = [],
  enhancedPhotosMap = {},
  onPhotoEnhanced,
  isSettingsOpen = false,
  onCloseSettings,
  onUpdateBox,
  onToggleBox: _onToggleBox,
  onDuplicateBox: _onDuplicateBox,
  onDeleteBox: _onDeleteBox,
  onClose: _onClose,
  startWithNewChat = false,
  initialAttachedImages = [],
}) => {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';

  // Multi-session State (ChatGPT style persistent sessions)
  const [sessions, setSessions] = useState<StudioChatSession[]>(() => {
    const loaded = loadSessionsFromStorage(box.id);
    if (startWithNewChat || (initialAttachedImages && initialAttachedImages.length > 0)) {
      const topSession = loaded[0];
      const isTopEmpty = topSession && (!topSession.messages || topSession.messages.length === 0);
      if (isTopEmpty) {
        topSession.attachedImages = initialAttachedImages;
        topSession.title = initialAttachedImages.length > 0 ? `Enhance (${initialAttachedImages.length} photos)` : 'New chat';
        return [...loaded];
      }
      const newSession: StudioChatSession = {
        id: `session_${Date.now()}`,
        title: initialAttachedImages.length > 0 ? `Enhance (${initialAttachedImages.length} photos)` : 'New chat',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [],
        inputValue: '',
        attachedImages: initialAttachedImages,
      };
      return [newSession, ...loaded];
    }
    return loaded;
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    if (startWithNewChat || (initialAttachedImages && initialAttachedImages.length > 0)) {
      return sessions[0]?.id || `session_${Date.now()}`;
    }
    try {
      const savedActive = localStorage.getItem(`ea_image_studio_active_id_${box.id || 'default'}`);
      if (savedActive && sessions.some((s) => s.id === savedActive)) return savedActive;
    } catch {}
    return sessions[0]?.id || `session_${Date.now()}`;
  });

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0] || {
    id: activeSessionId,
    title: 'New chat',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
  };

  const [messages, setMessages] = useState<ImageChatMessage[]>(() => activeSession.messages || []);
  const [inputValue, setInputValue] = useState<string>(() => activeSession.inputValue || '');
  const [attachedImages, setAttachedImages] = useState<AttachedPhotoItem[]>(() => {
    if (initialAttachedImages && initialAttachedImages.length > 0) return initialAttachedImages;
    if (activeSession.attachedImages && activeSession.attachedImages.length > 0) return activeSession.attachedImages;
    if (activeSession.attachedImage) {
      return [{
        url: activeSession.attachedImage,
        photoIndex: activeSession.attachedImageIndex ?? undefined,
        name: activeSession.attachedImageName || undefined,
      }];
    }
    return [];
  });
  const [attachedImage, setAttachedImage] = useState<string | null>(() => attachedImages[0]?.url || activeSession.attachedImage || null);
  const [attachedImageIndex, setAttachedImageIndex] = useState<number | null>(() => attachedImages[0]?.photoIndex ?? activeSession.attachedImageIndex ?? null);
  const [attachedImageName, setAttachedImageName] = useState<string>(() => attachedImages[0]?.name || activeSession.attachedImageName || '');

  // UI state for sidebar tabs, recents & settings
  const [activeSidebarTab, setActiveSidebarTab] = useState<'chats' | 'settings'>(isSettingsOpen ? 'settings' : 'chats');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isRecentsExpanded, setIsRecentsExpanded] = useState(true);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renameTitleInput, setRenameTitleInput] = useState('');
  const [openMenuSessionId, setOpenMenuSessionId] = useState<string | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showOriginalMap, setShowOriginalMap] = useState<Record<string, boolean>>({});
  const [expandedPromptIds, setExpandedPromptIds] = useState<Record<string, boolean>>({});
  const [appliedPhotoMap, setAppliedPhotoMap] = useState<Record<string, boolean>>({});
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [showPromptSelector, setShowPromptSelector] = useState(false);
  const promptSelectorRef = useRef<HTMLDivElement>(null);
  const [lightboxModal, setLightboxModal] = useState<LightboxModalState | null>(null);
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const [hoveredMsgImageId, setHoveredMsgImageId] = useState<string | null>(null);

  const lightboxImageUrl = lightboxModal?.isOpen
    ? (lightboxModal.isOriginalActive && lightboxModal.originalUrl ? lightboxModal.originalUrl : lightboxModal.enhancedUrl)
    : null;

  const setLightboxImageUrl = (url: string | null) => {
    if (!url) {
      setLightboxModal(null);
    } else {
      setLightboxModal({ isOpen: true, enhancedUrl: url });
    }
  };

  useEffect(() => {
    setLightboxZoom(1);
  }, [lightboxModal?.enhancedUrl, lightboxModal?.isOpen]);

  // Close lightbox on Escape key
  useEffect(() => {
    if (!lightboxModal?.isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxModal(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxModal?.isOpen]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeEnhancingIdRef = useRef<string | null>(null);

  const isRunware = box.provider === 'runware_ai' || box.model?.startsWith('runware:');
  const isGoogle = box.provider === 'google_ai';
  const isLaoZhang = box.provider === 'laozhang_ai';
  const brandColor = isRunware ? '#10B981' : isLaoZhang ? '#2563EB' : isGoogle ? '#3B82F6' : '#10A37F';

  // Filter prompt templates: ONLY show templates relative to images
  const imagePrompts = availablePrompts.filter(isImagePrompt);

  const getPhotoUrl = (img: ImportedPostImage) => {
    if (img.stored_url) {
      return img.stored_url.startsWith('http') ? img.stored_url : `http://localhost:8085${img.stored_url}`;
    }
    return img.source_url;
  };

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  // Sync when activeSessionId changes
  useEffect(() => {
    const target = sessions.find((s) => s.id === activeSessionId);
    if (target) {
      setMessages(target.messages || []);
      setInputValue(target.inputValue || '');
      const imgs = target.attachedImages && target.attachedImages.length > 0
        ? target.attachedImages
        : (target.attachedImage ? [{ url: target.attachedImage, photoIndex: target.attachedImageIndex ?? undefined, name: target.attachedImageName || undefined }] : []);
      setAttachedImages(imgs);
      setAttachedImage(imgs[0]?.url || null);
      setAttachedImageIndex(imgs[0]?.photoIndex ?? null);
      setAttachedImageName(imgs[0]?.name || '');
      try {
        localStorage.setItem(`ea_image_studio_active_id_${box.id || 'default'}`, target.id);
      } catch {}
    }
  }, [activeSessionId]);

  // Sync startWithNewChat and initialAttachedImages props
  useEffect(() => {
    if (startWithNewChat || (initialAttachedImages && initialAttachedImages.length > 0)) {
      const photos = initialAttachedImages || [];
      if (messages.length === 0) {
        setAttachedImages(photos);
        setAttachedImage(photos[0]?.url || null);
        setAttachedImageIndex(photos[0]?.photoIndex ?? null);
        setAttachedImageName(photos[0]?.name || '');
        setSessions((prev) =>
          prev.map((s) =>
            s.id === activeSessionId
              ? {
                  ...s,
                  attachedImages: photos,
                  attachedImage: photos[0]?.url || null,
                  attachedImageIndex: photos[0]?.photoIndex ?? null,
                  attachedImageName: photos[0]?.name || '',
                  title: photos.length > 0 ? `Enhance (${photos.length} photos)` : s.title,
                }
              : s
          )
        );
      } else {
        const newSessionId = `session_${Date.now()}`;
        const newSession: StudioChatSession = {
          id: newSessionId,
          title: photos.length > 0 ? `Enhance (${photos.length} photos)` : 'New chat',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messages: [],
          inputValue: '',
          attachedImages: photos,
          attachedImage: photos[0]?.url || null,
          attachedImageIndex: photos[0]?.photoIndex ?? null,
          attachedImageName: photos[0]?.name || '',
        };
        setSessions((prev) => [newSession, ...prev]);
        setActiveSessionId(newSessionId);
        setMessages([]);
        setInputValue('');
        setAttachedImages(photos);
        setAttachedImage(photos[0]?.url || null);
        setAttachedImageIndex(photos[0]?.photoIndex ?? null);
        setAttachedImageName(photos[0]?.name || '');
      }
    }
  }, [startWithNewChat, initialAttachedImages]);

  // Sync isSettingsOpen prop
  useEffect(() => {
    if (isSettingsOpen !== undefined) {
      setActiveSidebarTab(isSettingsOpen ? 'settings' : 'chats');
      if (isSettingsOpen && isSidebarCollapsed) {
        setIsSidebarCollapsed(false);
      }
    }
  }, [isSettingsOpen]);

  // Close prompt selector when clicking outside of it (toggle button stays inside the ref)
  useEffect(() => {
    if (!showPromptSelector) return;
    const handleDown = (e: MouseEvent) => {
      if (promptSelectorRef.current && !promptSelectorRef.current.contains(e.target as Node)) {
        setShowPromptSelector(false);
      }
    };
    document.addEventListener('mousedown', handleDown);
    return () => document.removeEventListener('mousedown', handleDown);
  }, [showPromptSelector]);

  // Close session action menu on outside click
  useEffect(() => {
    if (!openMenuSessionId) return;
    const handleDocClick = () => setOpenMenuSessionId(null);
    window.addEventListener('click', handleDocClick);
    return () => window.removeEventListener('click', handleDocClick);
  }, [openMenuSessionId]);

  // Persist active session updates to sessions list and storage
  useEffect(() => {
    setSessions((prev) => {
      let hasChanges = false;
      const next = prev.map((s) => {
        if (s.id === activeSessionId) {
          hasChanges = true;
          return {
            ...s,
            messages,
            inputValue,
            attachedImages,
            attachedImage: attachedImages[0]?.url || null,
            attachedImageIndex: attachedImages[0]?.photoIndex ?? null,
            attachedImageName: attachedImages[0]?.name || '',
            updatedAt: Date.now(),
          };
        }
        return s;
      });
      if (hasChanges) {
        saveSessionsToStorage(box.id, next);
        return next;
      }
      return prev;
    });
  }, [messages, inputValue, attachedImages, activeSessionId, box.id]);

  // Session Action Handlers
  const handleNewChat = () => {
    // 1. If currently active chat is already empty, stay in it rather than creating a duplicate
    const isCurrentEmpty = messages.length === 0 && attachedImages.length === 0;
    if (isCurrentEmpty) {
      setActiveSidebarTab('chats');
      textareaRef.current?.focus();
      return;
    }

    // 2. If another chat in the list is already empty and unpinned, reuse that empty chat
    const existingEmptySession = sessions.find(
      (s) => s.id !== activeSessionId && (!s.messages || s.messages.length === 0) && (!s.attachedImages || s.attachedImages.length === 0) && !s.attachedImage
    );
    if (existingEmptySession) {
      handleSelectSession(existingEmptySession.id);
      setActiveSidebarTab('chats');
      setTimeout(() => textareaRef.current?.focus(), 50);
      return;
    }

    // 3. Otherwise create a brand new chat session
    const newSession: StudioChatSession = {
      id: `session_${Date.now()}`,
      title: 'New chat',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
      inputValue: '',
      attachedImages: [],
      attachedImage: null,
      attachedImageIndex: null,
      attachedImageName: '',
    };
    const updated = [newSession, ...sessions];
    setSessions(updated);
    setActiveSessionId(newSession.id);
    setMessages([]);
    setInputValue('');
    setAttachedImages([]);
    setAttachedImage(null);
    setAttachedImageIndex(null);
    setAttachedImageName('');
    setActiveSidebarTab('chats');
    saveSessionsToStorage(box.id, updated);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleSelectSession = (sessionId: string) => {
    if (sessionId === activeSessionId) return;
    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSessionId
          ? {
              ...s,
              messages,
              inputValue,
              attachedImages,
              attachedImage: attachedImages[0]?.url || null,
              attachedImageIndex: attachedImages[0]?.photoIndex ?? null,
              attachedImageName: attachedImages[0]?.name || '',
              updatedAt: Date.now(),
            }
          : s
      )
    );
    const target = sessions.find((s) => s.id === sessionId);
    if (target) {
      setActiveSessionId(target.id);
      setMessages(target.messages || []);
      setInputValue(target.inputValue || '');
      const imgs = target.attachedImages && target.attachedImages.length > 0
        ? target.attachedImages
        : (target.attachedImage ? [{ url: target.attachedImage, photoIndex: target.attachedImageIndex ?? undefined, name: target.attachedImageName || undefined }] : []);
      setAttachedImages(imgs);
      setAttachedImage(imgs[0]?.url || null);
      setAttachedImageIndex(imgs[0]?.photoIndex ?? null);
      setAttachedImageName(imgs[0]?.name || '');
    }
  };

  const handleTogglePinSession = (sessionId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSessions((prev) => {
      const next = prev.map((s) => (s.id === sessionId ? { ...s, isPinned: !s.isPinned } : s));
      saveSessionsToStorage(box.id, next);
      return next;
    });
    setOpenMenuSessionId(null);
  };

  const handleStartRename = (session: StudioChatSession, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setRenamingSessionId(session.id);
    setRenameTitleInput(session.title);
    setOpenMenuSessionId(null);
  };

  const handleSaveRename = (sessionId: string) => {
    const trimmed = renameTitleInput.trim();
    if (trimmed) {
      setSessions((prev) => {
        const next = prev.map((s) => (s.id === sessionId ? { ...s, title: trimmed } : s));
        saveSessionsToStorage(box.id, next);
        return next;
      });
    }
    setRenamingSessionId(null);
  };

  const handleDeleteSession = (sessionId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== sessionId);
      if (next.length === 0) {
        const fresh: StudioChatSession = {
          id: `session_${Date.now()}`,
          title: 'New chat',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messages: [],
        };
        setActiveSessionId(fresh.id);
        setMessages([]);
        setAttachedImages([]);
        setAttachedImage(null);
        setAttachedImageIndex(null);
        setAttachedImageName('');
        saveSessionsToStorage(box.id, [fresh]);
        return [fresh];
      }
      if (activeSessionId === sessionId) {
        setActiveSessionId(next[0].id);
        setMessages(next[0].messages || []);
        setInputValue(next[0].inputValue || '');
        const nextImgs = next[0].attachedImages && next[0].attachedImages.length > 0
          ? next[0].attachedImages
          : (next[0].attachedImage ? [{ url: next[0].attachedImage, photoIndex: next[0].attachedImageIndex ?? undefined, name: next[0].attachedImageName || undefined }] : []);
        setAttachedImages(nextImgs);
        setAttachedImage(nextImgs[0]?.url || null);
        setAttachedImageIndex(nextImgs[0]?.photoIndex ?? null);
        setAttachedImageName(nextImgs[0]?.name || '');
      }
      saveSessionsToStorage(box.id, next);
      return next;
    });
    setOpenMenuSessionId(null);
    showToast('Chat deleted');
  };

  // Auto-resize input textarea dynamically like ChatGPT
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const scrollHeight = el.scrollHeight;
    const maxHeight = 200;
    if (scrollHeight > maxHeight) {
      el.style.height = `${maxHeight}px`;
      el.style.overflowY = 'auto';
    } else {
      el.style.height = `${Math.max(scrollHeight, 26)}px`;
      el.style.overflowY = 'hidden';
    }
  }, [inputValue]);

  // Toast timer
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  const formatMessageTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    showToast('Copied to clipboard');
  };

  const handleDownloadImage = async (url: string) => {
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `enhanced-property-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('Image downloaded');
    } catch {
      window.open(url, '_blank');
    }
  };

  const handleAdoptPrompt = (newPromptText: string) => {
    onUpdateBox(box.id, { templateText: newPromptText });
    showToast('✨ Updated prompt instructions for this node');
  };

  // Attach / Toggle an imported photo from the right sidebar
  const handleAttachPostPhoto = (img: ImportedPostImage) => {
    const url = getPhotoUrl(img);
    setAttachedImages((prev) => {
      const exists = prev.some((p) => p.photoIndex === img.index || p.url === url);
      if (exists) {
        const next = prev.filter((p) => !(p.photoIndex === img.index || p.url === url));
        showToast(`Removed Photo #${img.index}`);
        return next;
      } else {
        const next = [...prev, { url, photoIndex: img.index, name: `Photo #${img.index}` }];
        showToast(`Added Photo #${img.index} (${next.length} selected)`);
        return next;
      }
    });
    textareaRef.current?.focus();
  };

  const handleSelectAllPostPhotos = () => {
    const all = importedPhotos.map((img) => ({
      url: getPhotoUrl(img),
      photoIndex: img.index,
      name: `Photo #${img.index}`,
    }));
    setAttachedImages(all);
    showToast(`Selected all ${all.length} photos`);
  };

  const handleClearAttachedPhotos = () => {
    setAttachedImages([]);
    setAttachedImage(null);
    setAttachedImageIndex(null);
    setAttachedImageName('');
    showToast('Cleared attached photos');
  };

  // Handle local file selection from computer (supports multiple)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const result = uploadEvent.target?.result as string;
        if (result) {
          setAttachedImages((prev) => [
            ...prev,
            { url: result, name: file.name }
          ]);
        }
      };
      reader.readAsDataURL(file);
    });
    showToast(`Attached ${files.length} photo${files.length > 1 ? 's' : ''}`);
    e.target.value = '';
  };

  // Handle Drag & Drop onto chatbox (supports multiple)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);

    try {
      const jsonData = e.dataTransfer.getData('application/json');
      if (jsonData) {
        const parsed = JSON.parse(jsonData);
        if (parsed.url) {
          setAttachedImages((prev) => {
            if (prev.some((p) => p.photoIndex === parsed.index || p.url === parsed.url)) return prev;
            return [...prev, { url: parsed.url, photoIndex: parsed.index ?? undefined, name: parsed.index !== undefined ? `Photo #${parsed.index}` : 'Attached photo' }];
          });
          showToast(`Attached Photo #${parsed.index ?? ''}`);
          textareaRef.current?.focus();
          return;
        }
      }
    } catch {}

    const textUrl = e.dataTransfer.getData('text/plain');
    if (textUrl && (textUrl.startsWith('http') || textUrl.startsWith('data:'))) {
      setAttachedImages((prev) => [...prev, { url: textUrl, name: 'Attached photo' }]);
      showToast('Attached photo');
      textareaRef.current?.focus();
      return;
    }

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      files.forEach((file) => {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (uploadEvt) => {
            const res = uploadEvt.target?.result as string;
            if (res) {
              setAttachedImages((prev) => [...prev, { url: res, name: file.name }]);
            }
          };
          reader.readAsDataURL(file);
        }
      });
      showToast(`Attached ${files.length} file${files.length > 1 ? 's' : ''}`);
      textareaRef.current?.focus();
    }
  };

  // Run image enhancement request
  const runImageEnhancement = async (
    pendingMsgId: string,
    imgUrl: string,
    userText: string,
    photoIndex?: number,
    customInstructions?: string,
    customStrength?: number,
    customModel?: string,
    customProvider?: string
  ) => {
    setIsGenerating(true);
    activeEnhancingIdRef.current = pendingMsgId;
    abortControllerRef.current = new AbortController();
    const startTime = Date.now();

    const promptInstructions =
      customInstructions ||
      userText.trim() ||
      box.templateText ||
      box.customPrompt ||
      'Ultra high dynamic range real estate photography, balanced window light exposure, warm natural interior illumination, crisp 8k architectural details.';
    const strength = customStrength ?? (box.strength ?? 0.65);
    const provider = customProvider || box.provider || 'runware_ai';
    const model = customModel || box.model || 'runware:101@1';

    try {
      const resp = await fetch('http://localhost:8085/api/facebook-import/enhance-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current?.signal,
        body: JSON.stringify({
          image_url: imgUrl,
          provider,
          model,
          prompt_name: box.title || 'Image Enhancement',
          prompt_instructions: promptInstructions,
          strength,
        }),
      });

      const data = await resp.json();
      const durationMs = Date.now() - startTime;

      if (!resp.ok || data.status !== 'success' || !data.enhanced_url) {
        throw new Error(data.message || 'Image enhancement processing failed');
      }

      const assistantMsg: ImageChatMessage = {
        id: pendingMsgId,
        role: 'assistant',
        content: `✨ Enhanced property photo using ${getAIModelDisplayName(provider, model)} (${Math.round(durationMs / 100) / 10}s)`,
        timestamp: Date.now(),
        originalImageUrl: imgUrl,
        enhancedImageUrl: data.enhanced_url,
        durationMs,
        model,
        photoIndex,
        isPending: false,
      };

      setMessages((prev) => {
        const hasPending = prev.some((m) => m.id === pendingMsgId);
        return hasPending ? prev.map((m) => (m.id === pendingMsgId ? assistantMsg : m)) : [...prev, assistantMsg];
      });

      setSessions((prev) => {
        const next = prev.map((s) => {
          if (s.id === activeSessionId) {
            const hasPending = s.messages.some((m) => m.id === pendingMsgId);
            const nextMsgs = hasPending
              ? s.messages.map((m) => (m.id === pendingMsgId ? assistantMsg : m))
              : [...s.messages, assistantMsg];
            return { ...s, messages: nextMsgs, updatedAt: Date.now() };
          }
          return s;
        });
        saveSessionsToStorage(box.id, next);
        return next;
      });

      // If photo originated from post, auto sync with parent gallery
      if (photoIndex !== undefined && onPhotoEnhanced) {
        onPhotoEnhanced(photoIndex, data.enhanced_url);
        setAppliedPhotoMap((prev) => ({ ...prev, [pendingMsgId]: true }));
        showToast(`✨ Automatically updated Photo #${photoIndex} with enhanced version!`);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      const errorMsg: ImageChatMessage = {
        id: pendingMsgId,
        role: 'assistant',
        content: `⚠️ Image enhancement failed: ${err.message || 'Please verify API key and network connection'}.`,
        timestamp: Date.now(),
        durationMs: Date.now() - startTime,
        model,
        photoIndex,
        isPending: false,
      };

      setMessages((prev) => prev.map((m) => (m.id === pendingMsgId ? errorMsg : m)));
      setSessions((prev) => {
        const next = prev.map((s) => {
          if (s.id === activeSessionId) {
            return {
              ...s,
              messages: s.messages.map((m) => (m.id === pendingMsgId ? errorMsg : m)),
              updatedAt: Date.now(),
            };
          }
          return s;
        });
        saveSessionsToStorage(box.id, next);
        return next;
      });
    } finally {
      setIsGenerating(false);
      activeEnhancingIdRef.current = null;
      abortControllerRef.current = null;
      textareaRef.current?.focus();
    }
  };

  // Run prompt instruction refinement chat request (Text only)
  const runPromptRefinement = async (pendingMsgId: string, promptToSend: string) => {
    setIsGenerating(true);
    abortControllerRef.current = new AbortController();
    const startTime = Date.now();

    try {
      const resp = await fetch('http://localhost:8085/api/facebook-import/generate-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current?.signal,
        body: JSON.stringify({
          provider: 'google_ai',
          model: 'gemini-flash-latest',
          template_id: '',
          template_name: 'Image Prompt Refiner',
          template_text:
            'You are an expert AI vision and real estate photo enhancement prompt engineer. Analyze the user instruction and generate improved, high-converting image enhancement prompt instructions (specifying lighting, HDR balance, window exposure, 8k clarity, and materials). Keep the output professional and directly ready to use in Runware FLUX/SDXL models.',
          raw_content: `Current Prompt: "${box.templateText || ''}"\nUser Request: "${promptToSend}"`,
          custom_prompt: 'Provide the recommended prompt instructions clearly.',
        }),
      });

      const data = await resp.json();
      const durationMs = Date.now() - startTime;

      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Failed to refine image prompt instructions.');
      }

      const generatedContent = data.generated_content || '';
      const assistantMsg: ImageChatMessage = {
        id: pendingMsgId,
        role: 'assistant',
        content: generatedContent,
        timestamp: Date.now(),
        durationMs,
        model: box.model,
        isPromptProposal: true,
        proposedPrompt: generatedContent,
        isPending: false,
      };

      setMessages((prev) => prev.map((m) => (m.id === pendingMsgId ? assistantMsg : m)));
      setSessions((prev) => {
        const next = prev.map((s) => {
          if (s.id === activeSessionId) {
            return {
              ...s,
              messages: s.messages.map((m) => (m.id === pendingMsgId ? assistantMsg : m)),
              updatedAt: Date.now(),
            };
          }
          return s;
        });
        saveSessionsToStorage(box.id, next);
        return next;
      });
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      const errorMsg: ImageChatMessage = {
        id: pendingMsgId,
        role: 'assistant',
        content: `⚠️ Prompt refinement failed: ${err.message || 'Check connection'}.`,
        timestamp: Date.now(),
        durationMs: Date.now() - startTime,
        model: box.model,
        isPending: false,
      };
      setMessages((prev) => prev.map((m) => (m.id === pendingMsgId ? errorMsg : m)));
      setSessions((prev) => {
        const next = prev.map((s) => {
          if (s.id === activeSessionId) {
            return {
              ...s,
              messages: s.messages.map((m) => (m.id === pendingMsgId ? errorMsg : m)),
              updatedAt: Date.now(),
            };
          }
          return s;
        });
        saveSessionsToStorage(box.id, next);
        return next;
      });
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
      textareaRef.current?.focus();
    }
  };

  // Run multi-image enhancement request
  const runMultiImageEnhancement = async (
    pendingMsgId: string,
    imagesList: AttachedPhotoItem[],
    userText: string,
    customInstructions?: string,
    customStrength?: number,
    customModel?: string,
    customProvider?: string
  ) => {
    setIsGenerating(true);
    activeEnhancingIdRef.current = pendingMsgId;
    abortControllerRef.current = new AbortController();
    const startTime = Date.now();

    const promptInstructions =
      customInstructions ||
      userText.trim() ||
      box.templateText ||
      box.customPrompt ||
      'Ultra high dynamic range real estate photography, balanced window light exposure, warm natural interior illumination, crisp 8k architectural details.';
    const strength = customStrength ?? (box.strength ?? 0.65);
    const provider = customProvider || box.provider || 'runware_ai';
    const model = customModel || box.model || 'runware:101@1';

    const enhancedResults: EnhancedPhotoItem[] = [];

    try {
      for (let i = 0; i < imagesList.length; i++) {
        if (abortControllerRef.current?.signal.aborted) break;
        const currentItem = imagesList[i];

        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingMsgId
              ? {
                  ...m,
                  content: `Enhancing photos (${i}/${imagesList.length}) with ${getAIModelDisplayName(provider, model)}...`,
                  pendingDoneCount: i,
                  enhancedImages: [...enhancedResults],
                }
              : m
          )
        );

        const resp = await fetch('http://localhost:8085/api/facebook-import/enhance-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: abortControllerRef.current?.signal,
          body: JSON.stringify({
            image_url: currentItem.url,
            provider,
            model,
            prompt_name: box.title || 'Image Enhancement',
            prompt_instructions: promptInstructions,
            strength,
          }),
        });

        const data = await resp.json();
        if (!resp.ok || data.status !== 'success' || !data.enhanced_url) {
          throw new Error(data.message || `Failed to enhance photo ${currentItem.name || '#' + (currentItem.photoIndex ?? (i + 1))}`);
        }

        const enhancedItem: EnhancedPhotoItem = {
          originalUrl: currentItem.url,
          enhancedUrl: data.enhanced_url,
          photoIndex: currentItem.photoIndex,
          name: currentItem.name,
        };
        enhancedResults.push(enhancedItem);

        if (currentItem.photoIndex !== undefined && onPhotoEnhanced) {
          onPhotoEnhanced(currentItem.photoIndex, data.enhanced_url);
        }
      }

      const durationMs = Date.now() - startTime;
      const count = enhancedResults.length;
      const assistantMsg: ImageChatMessage = {
        id: pendingMsgId,
        role: 'assistant',
        content: count === 1
          ? `✨ Enhanced property photo using ${getAIModelDisplayName(provider, model)} (${Math.round(durationMs / 100) / 10}s)`
          : `✨ Successfully enhanced ${count} photos using ${getAIModelDisplayName(provider, model)} (${Math.round(durationMs / 100) / 10}s)`,
        timestamp: Date.now(),
        originalImageUrl: enhancedResults[0]?.originalUrl,
        originalImages: [...imagesList],
        enhancedImageUrl: enhancedResults[0]?.enhancedUrl,
        enhancedImages: enhancedResults,
        durationMs,
        model,
        photoIndex: enhancedResults[0]?.photoIndex,
        isPending: false,
        pendingTotalCount: imagesList.length,
        pendingDoneCount: count,
      };

      setMessages((prev) =>
        prev.map((m) => (m.id === pendingMsgId ? assistantMsg : m))
      );

      setSessions((prev) => {
        const next = prev.map((s) => {
          if (s.id === activeSessionId) {
            const nextMsgs = s.messages.map((m) => (m.id === pendingMsgId ? assistantMsg : m));
            return { ...s, messages: nextMsgs, updatedAt: Date.now() };
          }
          return s;
        });
        saveSessionsToStorage(box.id, next);
        return next;
      });

      showToast(count === 1 ? '✨ Enhanced photo ready!' : `✨ Enhanced ${count} photos ready!`);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      const durationMs = Date.now() - startTime;
      const errorMsg: ImageChatMessage = {
        id: pendingMsgId,
        role: 'assistant',
        content: enhancedResults.length > 0
          ? `⚠️ Enhanced ${enhancedResults.length}/${imagesList.length} photos. Error: ${err.message || 'Processing error'}`
          : `⚠️ Image enhancement failed: ${err.message || 'Please check network and API key'}.`,
        timestamp: Date.now(),
        originalImageUrl: imagesList[0]?.url,
        originalImages: [...imagesList],
        enhancedImageUrl: enhancedResults[0]?.enhancedUrl,
        enhancedImages: enhancedResults,
        durationMs,
        model,
        photoIndex: imagesList[0]?.photoIndex,
        isPending: false,
      };

      setMessages((prev) => prev.map((m) => (m.id === pendingMsgId ? errorMsg : m)));
      setSessions((prev) => {
        const next = prev.map((s) => {
          if (s.id === activeSessionId) {
            return {
              ...s,
              messages: s.messages.map((m) => (m.id === pendingMsgId ? errorMsg : m)),
              updatedAt: Date.now(),
            };
          }
          return s;
        });
        saveSessionsToStorage(box.id, next);
        return next;
      });
    } finally {
      setIsGenerating(false);
      activeEnhancingIdRef.current = null;
      abortControllerRef.current = null;
      textareaRef.current?.focus();
    }
  };

  // Send message
  const handleSendMessage = (overrideText?: string, overrideImage?: string, overridePhotoIndex?: number) => {
    const textToSend = (overrideText !== undefined ? overrideText : inputValue).trim();
    const imagesToSend: AttachedPhotoItem[] = overrideImage !== undefined
      ? [{ url: overrideImage, photoIndex: overridePhotoIndex }]
      : (attachedImages.length > 0
          ? [...attachedImages]
          : (attachedImage ? [{ url: attachedImage, photoIndex: attachedImageIndex ?? undefined, name: attachedImageName }] : []));

    if (!textToSend && imagesToSend.length === 0) return;
    if (isGenerating) return;

    const userMsg: ImageChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: textToSend || (imagesToSend.length === 1 ? 'Enhance this property photo' : `Enhance these ${imagesToSend.length} property photos`),
      originalImageUrl: imagesToSend[0]?.url,
      originalImages: imagesToSend.length > 0 ? [...imagesToSend] : undefined,
      photoIndex: imagesToSend[0]?.photoIndex,
      timestamp: Date.now(),
    };

    setInputValue('');
    setAttachedImages([]);
    setAttachedImage(null);
    setAttachedImageIndex(null);
    setAttachedImageName('');

    if (imagesToSend.length > 0) {
      const pendingMsgId = `msg-${Date.now()}-ai-pending`;
      const promptInstructions =
        textToSend.trim() ||
        box.templateText ||
        box.customPrompt ||
        'Ultra high dynamic range real estate photography, balanced window light exposure, warm natural interior illumination, crisp 8k architectural details.';
      const strength = box.strength ?? 0.65;

      const pendingAssistantMsg: ImageChatMessage = {
        id: pendingMsgId,
        role: 'assistant',
        content: imagesToSend.length === 1
          ? `Processing with ${getAIModelDisplayName(box.provider, box.model)}...`
          : `Enhancing photos (0/${imagesToSend.length}) with ${getAIModelDisplayName(box.provider, box.model)}...`,
        timestamp: Date.now(),
        originalImageUrl: imagesToSend[0]?.url,
        originalImages: [...imagesToSend],
        enhancedImages: [],
        photoIndex: imagesToSend[0]?.photoIndex,
        isPending: true,
        pendingTotalCount: imagesToSend.length,
        pendingDoneCount: 0,
        model: box.model,
        promptInstructions,
        strength,
      };

      const newHistory = [...messages, userMsg, pendingAssistantMsg];
      setMessages(newHistory);

      // Auto-update session title if it's default
      setSessions((prev) => {
        const next = prev.map((s) => {
          if (s.id === activeSessionId) {
            const isDefault = s.title === 'New chat' || s.title === 'Recent Conversation' || s.title.startsWith('Enhance (');
            const newTitle = isDefault
              ? (textToSend ? textToSend.slice(0, 28).trim() : (imagesToSend.length > 1 ? `Batch (${imagesToSend.length} photos)` : (imagesToSend[0]?.photoIndex !== undefined ? `Photo #${imagesToSend[0].photoIndex}` : 'Photo Enhancement')))
              : s.title;
            return {
              ...s,
              title: newTitle,
              messages: newHistory,
              updatedAt: Date.now(),
            };
          }
          return s;
        });
        saveSessionsToStorage(box.id, next);
        return next;
      });

      runMultiImageEnhancement(
        pendingMsgId,
        imagesToSend,
        textToSend,
        promptInstructions,
        strength,
        box.model,
        box.provider
      );
    } else {
      const pendingMsgId = `msg-${Date.now()}-ai-pending`;
      const pendingAssistantMsg: ImageChatMessage = {
        id: pendingMsgId,
        role: 'assistant',
        content: `Refining prompt instructions...`,
        timestamp: Date.now(),
        isPending: true,
        model: box.model,
        promptInstructions: textToSend,
      };

      const newHistory = [...messages, userMsg, pendingAssistantMsg];
      setMessages(newHistory);

      setSessions((prev) => {
        const next = prev.map((s) => {
          if (s.id === activeSessionId) {
            const isDefault = s.title === 'New chat' || s.title === 'Recent Conversation';
            const newTitle = isDefault ? textToSend.slice(0, 28).trim() : s.title;
            return {
              ...s,
              title: newTitle,
              messages: newHistory,
              updatedAt: Date.now(),
            };
          }
          return s;
        });
        saveSessionsToStorage(box.id, next);
        return next;
      });

      runPromptRefinement(pendingMsgId, textToSend);
    }
  };

  // Auto-resume any pending enhancement when opening or reloading
  useEffect(() => {
    const pendingMsg = messages.find((m) => m.isPending && m.originalImageUrl);
    if (pendingMsg && activeEnhancingIdRef.current !== pendingMsg.id) {
      runImageEnhancement(
        pendingMsg.id,
        pendingMsg.originalImageUrl!,
        '',
        pendingMsg.photoIndex,
        pendingMsg.promptInstructions,
        pendingMsg.strength,
        pendingMsg.model,
        box.provider
      );
    }
  }, [messages, activeSessionId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        backgroundColor: isDark ? '#0D1117' : 'var(--bg-main)',
        color: isDark ? '#E6EDF3' : 'var(--text-primary)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <style>{`
        @keyframes studioFadeIn {
          from { opacity: 0; transform: translateY(2px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes studioRailFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
      {/* Toast Feedback */}
      {toastMessage && (
        <div
          style={{
            position: 'absolute',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 110,
            backgroundColor: isDark ? '#161B22' : 'var(--bg-surface)',
            border: `1px solid ${brandColor}`,
            color: isDark ? '#FFFFFF' : 'var(--text-primary)',
            padding: '6px 14px',
            borderRadius: '16px',
            fontSize: '0.75rem',
            fontWeight: 400,
            boxShadow: isDark ? '0 4px 14px rgba(0,0,0,0.4)' : '0 4px 14px rgba(0,0,0,0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
          }}
        >
          <HiSparkles style={{ fontSize: '13px', color: brandColor }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Hidden file input for uploading images */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* MAIN CONTAINER: Drawer (Left) + Chat Canvas (Center) + Post Photos (Right) */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
        {/* ========================================================= */}
        {/* LEFT SIDEBAR: ChatGPT-style Recents & Settings (Images 3 & 4) */}
        {/* ========================================================= */}
        <div
          style={{
            width: isSidebarCollapsed ? '54px' : '260px',
            minWidth: isSidebarCollapsed ? '54px' : '260px',
            borderRight: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid var(--border-color)',
            backgroundColor: isDark ? '#171717' : '#F9FAFB',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 40,
            flexShrink: 0,
            transition: 'width 0.28s cubic-bezier(0.16, 1, 0.3, 1), min-width 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
            overflow: 'hidden',
          }}
        >
          {isSidebarCollapsed ? (
            /* COLLAPSED RAIL: ONLY icons (Toggle, Plus, Chat, Settings) */
            <div
              style={{
                width: '54px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '10px 0',
                gap: '8px',
                height: '100%',
                animation: 'studioRailFade 0.2s ease',
              }}
            >
              {/* Toggle Sidebar Icon (matching Image 2) */}
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(false)}
                title="Expand sidebar"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: isDark ? '#CCCCCC' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)';
                  e.currentTarget.style.color = isDark ? '#FFFFFF' : 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = isDark ? '#CCCCCC' : 'var(--text-secondary)';
                }}
              >
                <FiSidebar style={{ fontSize: '16px' }} />
              </button>

              {/* Plus (New chat) Icon */}
              <button
                type="button"
                onClick={handleNewChat}
                title="New chat"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid var(--border-color)',
                  color: isDark ? '#FFFFFF' : 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: 'none',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)';
                }}
              >
                <FiPlus style={{ fontSize: '16px' }} />
              </button>

              {/* Subtle divider */}
              <div
                style={{
                  width: '28px',
                  height: '1px',
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'var(--border-color)',
                  margin: '2px 0',
                }}
              />

              {/* Chat / Recents Icon */}
              <button
                type="button"
                onClick={() => {
                  setActiveSidebarTab('chats');
                  setIsSidebarCollapsed(false);
                }}
                title="Recents"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  border: activeSidebarTab === 'chats'
                    ? (isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.08)')
                    : '1px solid transparent',
                  backgroundColor: activeSidebarTab === 'chats'
                    ? (isDark ? '#262626' : 'rgba(0, 0, 0, 0.06)')
                    : 'transparent',
                  color: activeSidebarTab === 'chats'
                    ? (isDark ? '#FFFFFF' : 'var(--text-primary)')
                    : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: 'none',
                }}
                onMouseEnter={(e) => {
                  if (activeSidebarTab !== 'chats') {
                    e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)';
                    e.currentTarget.style.color = isDark ? '#FFFFFF' : 'var(--text-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeSidebarTab !== 'chats') {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--text-muted)';
                  }
                }}
              >
                <FiMessageSquare style={{ fontSize: '15px' }} />
              </button>

              {/* Settings Icon */}
              <button
                type="button"
                onClick={() => {
                  setActiveSidebarTab('settings');
                  setIsSidebarCollapsed(false);
                }}
                title="Prompt & Settings"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  border: activeSidebarTab === 'settings'
                    ? (isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.08)')
                    : '1px solid transparent',
                  backgroundColor: activeSidebarTab === 'settings'
                    ? (isDark ? '#262626' : 'rgba(0, 0, 0, 0.06)')
                    : 'transparent',
                  color: activeSidebarTab === 'settings'
                    ? (isDark ? '#FFFFFF' : 'var(--text-primary)')
                    : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: 'none',
                }}
                onMouseEnter={(e) => {
                  if (activeSidebarTab !== 'settings') {
                    e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)';
                    e.currentTarget.style.color = isDark ? '#FFFFFF' : 'var(--text-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeSidebarTab !== 'settings') {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--text-muted)';
                  }
                }}
              >
                <FiSliders style={{ fontSize: '15px' }} />
              </button>
            </div>
          ) : (
            <div
              style={{
                width: '260px',
                minWidth: '260px',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                animation: 'studioFadeIn 0.22s ease',
              }}
            >
              {/* Top Header: New Chat & Navigation */}
              <div
                style={{
                  padding: '0.75rem 0.75rem 0.5rem 0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.625rem',
                  borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid var(--border-color)',
                }}
              >
            {/* New Chat Button (ChatGPT Style) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <button
                type="button"
                onClick={handleNewChat}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#FFFFFF',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid var(--border-color)',
                  color: isDark ? '#FFFFFF' : 'var(--text-primary)',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: 'none',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.04)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.06)' : '#FFFFFF';
                }}
                title="Start a new chat (keeps previous chats saved)"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FiPlus style={{ fontSize: '15px' }} />
                  <span>New chat</span>
                </div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', opacity: 0.8 }}>⌘N</span>
              </button>

              {/* Collapse sidebar button */}
              <button
                type="button"
                onClick={() => {
                  setIsSidebarCollapsed(true);
                  onCloseSettings?.();
                }}
                title="Close sidebar"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                <FiSidebar style={{ fontSize: '15px' }} />
              </button>
            </div>

            {/* Segmented Tab Switcher: Recents vs Settings */}
            <div
              style={{
                display: 'flex',
                borderRadius: '8px',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(0, 0, 0, 0.06)',
                padding: '3px',
                gap: '3px',
              }}
            >
              <button
                type="button"
                onClick={() => setActiveSidebarTab('chats')}
                style={{
                  flex: 1,
                  height: '34px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  border: activeSidebarTab === 'chats'
                    ? (isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.08)')
                    : '1px solid transparent',
                  backgroundColor: activeSidebarTab === 'chats'
                    ? (isDark ? '#262626' : '#FFFFFF')
                    : 'transparent',
                  color: activeSidebarTab === 'chats'
                    ? (isDark ? '#FFFFFF' : 'var(--text-primary)')
                    : 'var(--text-muted)',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
                onMouseEnter={(e) => {
                  if (activeSidebarTab !== 'chats') {
                    e.currentTarget.style.color = isDark ? '#FFFFFF' : 'var(--text-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeSidebarTab !== 'chats') {
                    e.currentTarget.style.color = 'var(--text-muted)';
                  }
                }}
              >
                <FiMessageSquare style={{ fontSize: '13px' }} />
                <span>Recents</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSidebarTab('settings')}
                style={{
                  flex: 1,
                  height: '34px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  border: activeSidebarTab === 'settings'
                    ? (isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.08)')
                    : '1px solid transparent',
                  backgroundColor: activeSidebarTab === 'settings'
                    ? (isDark ? '#262626' : '#FFFFFF')
                    : 'transparent',
                  color: activeSidebarTab === 'settings'
                    ? (isDark ? '#FFFFFF' : 'var(--text-primary)')
                    : 'var(--text-muted)',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
                onMouseEnter={(e) => {
                  if (activeSidebarTab !== 'settings') {
                    e.currentTarget.style.color = isDark ? '#FFFFFF' : 'var(--text-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeSidebarTab !== 'settings') {
                    e.currentTarget.style.color = 'var(--text-muted)';
                  }
                }}
              >
                <FiSliders style={{ fontSize: '13px' }} />
                <span>Settings</span>
              </button>
            </div>
          </div>

          {/* TAB 1: CHATS (ChatGPT Style History - Images 3 & 4) */}
          {activeSidebarTab === 'chats' ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              {/* Recents collapsible header */}
              <div
                onClick={() => setIsRecentsExpanded((prev) => !prev)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 12px 4px 12px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: isDark ? '#9B9B9B' : 'var(--text-muted)',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <span>Recents</span>
                {isRecentsExpanded ? (
                  <FiChevronDown style={{ fontSize: '12px' }} />
                ) : (
                  <FiChevronRight style={{ fontSize: '12px' }} />
                )}
              </div>

              {/* Sessions list */}
              {isRecentsExpanded && (
                <div
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '2px 8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                >
                  {/* Sorted sessions: pinned first, then by updatedAt desc */}
                  {[...sessions]
                    .sort((a, b) => {
                      if (a.isPinned && !b.isPinned) return -1;
                      if (!a.isPinned && b.isPinned) return 1;
                      return (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt);
                    })
                    .map((session) => {
                      const isActive = session.id === activeSessionId;
                      const isRenaming = renamingSessionId === session.id;
                      const isMenuOpen = openMenuSessionId === session.id;

                      return (
                        <div
                          key={session.id}
                          onClick={() => handleSelectSession(session.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            height: '36px',
                            padding: '0 8px 0 10px',
                            borderRadius: '8px',
                            backgroundColor: isActive
                              ? (isDark ? '#212121' : 'rgba(0, 0, 0, 0.08)')
                              : 'transparent',
                            color: isActive
                              ? (isDark ? '#ECECEC' : 'var(--text-primary)')
                              : (isDark ? '#B4B4B4' : 'var(--text-secondary)'),
                            cursor: 'pointer',
                            position: 'relative',
                            transition: 'background-color 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            if (!isActive) {
                              e.currentTarget.style.backgroundColor = isDark ? '#1F1F1F' : 'rgba(0, 0, 0, 0.04)';
                            }
                            const actions = e.currentTarget.querySelector('.session-actions') as HTMLElement;
                            if (actions) actions.style.opacity = '1';
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive) {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }
                            const actions = e.currentTarget.querySelector('.session-actions') as HTMLElement;
                            if (actions && !isMenuOpen) actions.style.opacity = isActive ? '1' : '0';
                          }}
                        >
                          {/* Title / Inline Rename Input */}
                          {isRenaming ? (
                            <div
                              style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                autoFocus
                                value={renameTitleInput}
                                onChange={(e) => setRenameTitleInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveRename(session.id);
                                  if (e.key === 'Escape') setRenamingSessionId(null);
                                }}
                                style={{
                                  flex: 1,
                                  height: '24px',
                                  backgroundColor: isDark ? '#0D1117' : '#FFFFFF',
                                  border: '1px solid #10B981',
                                  borderRadius: '4px',
                                  color: isDark ? '#FFFFFF' : 'var(--text-primary)',
                                  fontSize: '0.8125rem',
                                  padding: '0 6px',
                                  outline: 'none',
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveRename(session.id)}
                                title="Save"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#10B981',
                                  cursor: 'pointer',
                                  padding: '2px',
                                  display: 'flex',
                                  alignItems: 'center',
                                }}
                              >
                                <FiCheck style={{ fontSize: '13px' }} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setRenamingSessionId(null)}
                                title="Cancel"
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
                                <FiX style={{ fontSize: '13px' }} />
                              </button>
                            </div>
                          ) : (
                            <>
                              <span
                                style={{
                                  fontSize: '0.8125rem',
                                  fontWeight: isActive ? 500 : 400,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  flex: 1,
                                  marginRight: '6px',
                                }}
                                title={session.title}
                              >
                                {session.title}
                              </span>

                              {/* Action Buttons: Pin & 3-dots Menu (Matches Image 4!) */}
                              <div
                                className="session-actions"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '2px',
                                  opacity: isActive || isMenuOpen || session.isPinned ? 1 : 0,
                                  transition: 'opacity 0.15s ease',
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {/* Pin Toggle Button */}
                                <button
                                  type="button"
                                  onClick={(e) => handleTogglePinSession(session.id, e)}
                                  title={session.isPinned ? 'Unpin chat' : 'Pin chat'}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: session.isPinned ? (isDark ? '#F1F5F9' : '#0F172A') : 'var(--text-muted)',
                                    cursor: 'pointer',
                                    padding: '3px',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'color 0.15s ease',
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.color = isDark ? '#FFFFFF' : '#000000'; }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.color = session.isPinned
                                      ? (isDark ? '#F1F5F9' : '#0F172A')
                                      : 'var(--text-muted)';
                                  }}
                                >
                                  {session.isPinned ? (
                                    <BsPinAngleFill style={{ fontSize: '12px' }} />
                                  ) : (
                                    <BsPinAngle style={{ fontSize: '12px' }} />
                                  )}
                                </button>

                                {/* 3-dots Menu Button */}
                                <div style={{ position: 'relative' }}>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenMenuSessionId(isMenuOpen ? null : session.id);
                                    }}
                                    title="Options"
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: isMenuOpen ? (isDark ? '#FFFFFF' : 'var(--text-primary)') : 'var(--text-muted)',
                                      cursor: 'pointer',
                                      padding: '3px',
                                      borderRadius: '4px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    <FiMoreHorizontal style={{ fontSize: '13px' }} />
                                  </button>

                                  {/* Floating Options Popup */}
                                  {isMenuOpen && (
                                    <div
                                      style={{
                                        position: 'absolute',
                                        right: 0,
                                        top: '24px',
                                        zIndex: 100,
                                        width: '130px',
                                        backgroundColor: isDark ? '#212121' : '#FFFFFF',
                                        border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid var(--border-color)',
                                        borderRadius: '8px',
                                        padding: '4px',
                                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '2px',
                                      }}
                                    >
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          handleTogglePinSession(session.id, e);
                                        }}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '8px',
                                          padding: '6px 8px',
                                          borderRadius: '5px',
                                          border: 'none',
                                          backgroundColor: 'transparent',
                                          color: isDark ? '#ECECEC' : 'var(--text-primary)',
                                          fontSize: '0.75rem',
                                          cursor: 'pointer',
                                          textAlign: 'left',
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                      >
                                        <BsPinAngle style={{ fontSize: '12px' }} />
                                        <span>{session.isPinned ? 'Unpin' : 'Pin'}</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={(e) => handleStartRename(session, e)}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '8px',
                                          padding: '6px 8px',
                                          borderRadius: '5px',
                                          border: 'none',
                                          backgroundColor: 'transparent',
                                          color: isDark ? '#ECECEC' : 'var(--text-primary)',
                                          fontSize: '0.75rem',
                                          cursor: 'pointer',
                                          textAlign: 'left',
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                      >
                                        <FiEdit2 style={{ fontSize: '12px' }} />
                                        <span>Rename</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={(e) => handleDeleteSession(session.id, e)}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '8px',
                                          padding: '6px 8px',
                                          borderRadius: '5px',
                                          border: 'none',
                                          backgroundColor: 'transparent',
                                          color: '#EF4444',
                                          fontSize: '0.75rem',
                                          cursor: 'pointer',
                                          textAlign: 'left',
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                      >
                                        <FiTrash2 style={{ fontSize: '12px' }} />
                                        <span>Delete</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          ) : (
            /* TAB 2: MODERNIZED PROMPT & SETTINGS (Clean, professional dark layout) */
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '1rem 0.875rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem',
              }}
            >
              {/* Back to Chats button */}
              <button
                type="button"
                onClick={() => {
                  setActiveSidebarTab('chats');
                  onCloseSettings?.();
                }}
                style={{
                  alignSelf: 'flex-start',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                <span>← Back to Recents</span>
              </button>

              {/* Preset Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
                  Template Preset
                </label>
                <Select
                  options={[
                    ...imagePrompts.map((p) => ({
                      value: String(p.id),
                      label: p.name,
                    })),
                    { value: 'custom', label: 'Custom Image Prompt' },
                  ]}
                  value={
                    imagePrompts.some((p) => String(p.id) === String(box.templateId))
                      ? String(box.templateId)
                      : 'custom'
                  }
                  onChange={(val) => {
                    if (val === 'custom') {
                      onUpdateBox(box.id, { templateId: 'custom' });
                      return;
                    }
                    const matched = imagePrompts.find((p) => String(p.id) === String(val));
                    if (matched) {
                      onUpdateBox(box.id, {
                        templateId: String(matched.id),
                        templateText: matched.templateText,
                        title: box.title || matched.name,
                      });
                      showToast(`Loaded: ${matched.name}`);
                    }
                  }}
                  height="34px"
                />
              </div>

              {/* Prompt Textarea */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
                  Prompt Instructions
                </label>
                <textarea
                  value={box.templateText || ''}
                  onChange={(e) => onUpdateBox(box.id, { templateText: e.target.value })}
                  placeholder="Enter detailed enhancement prompt..."
                  rows={7}
                  style={{
                    width: '100%',
                    backgroundColor: isDark ? '#0D1117' : 'var(--bg-main)',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: isDark ? '#FFFFFF' : 'var(--text-primary)',
                    fontSize: '0.75rem',
                    lineHeight: 1.5,
                    padding: '0.625rem',
                    boxSizing: 'border-box',
                    outline: 'none',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* Strength Range Slider */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Enhancement Strength
                  </span>
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      padding: '1px 6px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(16, 185, 129, 0.15)',
                      color: '#10B981',
                    }}
                  >
                    {Math.round((box.strength ?? 0.65) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={box.strength ?? 0.65}
                  onChange={(e) => onUpdateBox(box.id, { strength: parseFloat(e.target.value) })}
                  style={{ width: '100%', accentColor: '#10B981', cursor: 'pointer' }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>

        {/* ========================================================= */}
        {/* CENTER COLUMN: ChatGPT-style Conversation & Input Area    */}
        {/* ========================================================= */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, height: '100%', position: 'relative' }}>
          {/* Scrollable Conversation Stream */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1.25rem 1.5rem',
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ maxWidth: '740px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', flex: 1 }}>
              {/* EMPTY STATE */}
              {messages.length === 0 && (
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2.5rem 1rem',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(16, 185, 129, 0.12)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '1rem',
                      boxShadow: '0 0 24px rgba(16, 185, 129, 0.15)',
                    }}
                  >
                    <RunwareIcon size={26} color="#10B981" />
                  </div>

                  <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: isDark ? '#FFFFFF' : 'var(--text-primary)', margin: '0 0 0.375rem 0' }}>
                    {box.title ? box.title.replace(/\bAI\s+/gi, '') : 'Image Enhancement'}
                  </h3>

                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', maxWidth: '440px', lineHeight: 1.5, margin: 0 }}>
                    Click or drag any post photo from the right panel into the input box to enhance or generate new variations.
                  </p>
                </div>
              )}

              {/* MESSAGES STREAM (Image 4 design) */}
              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                const showOriginal = Boolean(showOriginalMap[msg.id]);
                const isApplied = msg.photoIndex !== undefined && Boolean(appliedPhotoMap[msg.id]);

                if (isUser) {
                  const isLong = msg.content.length > 280;
                  const isExpanded = Boolean(expandedPromptIds[msg.id]);
                  const displayContent = isLong && !isExpanded ? `${msg.content.slice(0, 280)}...` : msg.content;

                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        width: '100%',
                        margin: '0.75rem 0',
                      }}
                    >
                      {/* Attached Photos (Small Squares) */}
                      {msg.originalImages && msg.originalImages.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px', justifyContent: 'flex-end', maxWidth: '380px' }}>
                          {msg.originalImages.map((orig, i) => (
                            <div
                              key={i}
                              onClick={() => setLightboxModal({
                                isOpen: true,
                                enhancedUrl: orig.url,
                                photoIndex: orig.photoIndex,
                                isOriginalActive: true,
                              })}
                              title={orig.photoIndex !== undefined ? `Photo #${orig.photoIndex} (Click to expand)` : 'Click to expand'}
                              style={{
                                position: 'relative',
                                width: '64px',
                                height: '64px',
                                borderRadius: '10px',
                                overflow: 'hidden',
                                border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid var(--border-color)',
                                cursor: 'zoom-in',
                                flexShrink: 0,
                                backgroundColor: '#000',
                                transition: 'transform 0.15s ease',
                              }}
                            >
                              <img
                                src={orig.url}
                                alt={`Original ${i + 1}`}
                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                              />
                              {orig.photoIndex !== undefined && (
                                <span
                                  style={{
                                    position: 'absolute',
                                    bottom: '2px',
                                    left: '2px',
                                    padding: '1px 4px',
                                    borderRadius: '3px',
                                    backgroundColor: 'rgba(0, 0, 0, 0.75)',
                                    color: '#FFFFFF',
                                    fontSize: '0.5625rem',
                                    fontWeight: 600,
                                  }}
                                >
                                  #{orig.photoIndex}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : msg.originalImageUrl ? (
                        <div
                          onClick={() => setLightboxModal({
                            isOpen: true,
                            enhancedUrl: msg.originalImageUrl!,
                            photoIndex: msg.photoIndex,
                            isOriginalActive: true,
                          })}
                          title="Click to view full image"
                          style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: '10px',
                            overflow: 'hidden',
                            border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid var(--border-color)',
                            marginBottom: '6px',
                            cursor: 'zoom-in',
                            backgroundColor: '#000',
                          }}
                        >
                          <img
                            src={msg.originalImageUrl}
                            alt="Sent photo"
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          />
                        </div>
                      ) : null}

                      {/* Blue Prompt Bubble */}
                      {msg.content && (
                        <div
                          style={{
                            background: isDark
                              ? 'linear-gradient(135deg, #1E3A8A 0%, #1D4ED8 100%)'
                              : 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                            color: '#FFFFFF',
                            borderRadius: '1.125rem',
                            padding: '0.875rem 1.125rem',
                            maxWidth: '85%',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.375rem',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '0.84375rem',
                              lineHeight: 1.55,
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                            }}
                          >
                            {displayContent}
                          </span>

                          {/* "Show more v" / "Show less ^" toggle button (Image 4) */}
                          {isLong && (
                            <button
                              type="button"
                              onClick={() => setExpandedPromptIds((prev) => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'rgba(255, 255, 255, 0.85)',
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                cursor: 'pointer',
                                padding: 0,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                marginTop: '2px',
                                alignSelf: 'flex-start',
                              }}
                            >
                              <span>{isExpanded ? 'Show less ∧' : 'Show more ∨'}</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Action icons below user bubble */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', opacity: 0.65 }}>
                        <button
                          type="button"
                          onClick={() => handleCopyText(msg.content, msg.id)}
                          title="Copy prompt"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: isDark ? '#C9D1D9' : 'var(--text-muted)',
                            cursor: 'pointer',
                            fontSize: '12px',
                            padding: '2px',
                          }}
                        >
                          {copiedId === msg.id ? <FiCheck /> : <FiCopy />}
                        </button>
                        <span style={{ fontSize: '0.625rem', color: isDark ? '#8E9196' : 'var(--text-muted)' }}>
                          {formatMessageTime(msg.timestamp)}
                        </span>
                      </div>
                    </div>
                  );
                }

                // Assistant Message (Image 4 design)
                if (msg.isPending) {
                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: '0.5rem',
                        margin: '0.75rem 0',
                        maxWidth: '100%',
                      }}
                    >
                      {/* Completed photos in current batch */}
                      {msg.enhancedImages && msg.enhancedImages.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '4px' }}>
                          {msg.enhancedImages.map((enh, i) => (
                            <div
                              key={i}
                              onClick={() => setLightboxModal({
                                isOpen: true,
                                enhancedUrl: enh.enhancedUrl,
                                originalUrl: enh.originalUrl,
                                photoIndex: enh.photoIndex,
                                name: enh.name,
                                promptInstructions: msg.promptInstructions,
                                isOriginalActive: false,
                              })}
                              title="Click to view full generated edit size"
                              style={{
                                position: 'relative',
                                width: '108px',
                                height: '108px',
                                borderRadius: '12px',
                                overflow: 'hidden',
                                border: '1px solid #10B981',
                                cursor: 'pointer',
                                backgroundColor: '#000',
                                flexShrink: 0,
                              }}
                            >
                              <img
                                src={enh.enhancedUrl}
                                alt="Enhanced preview"
                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                              />
                              <span
                                style={{
                                  position: 'absolute',
                                  top: '4px',
                                  left: '4px',
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  backgroundColor: 'rgba(0, 0, 0, 0.75)',
                                  color: '#FFFFFF',
                                  fontSize: '0.625rem',
                                  fontWeight: 600,
                                }}
                              >
                                {enh.photoIndex !== undefined ? `Photo #${enh.photoIndex}` : `#${i + 1}`}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            backgroundColor: 'rgba(16, 185, 129, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <RunwareIcon size={14} color="#10B981" />
                        </div>
                        <div
                          style={{
                            backgroundColor: isDark ? '#161B22' : 'var(--bg-surface)',
                            border: isDark ? 'none' : '1px solid var(--border-color)',
                            borderRadius: '12px',
                            padding: '0.5rem 0.875rem',
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.375rem',
                          }}
                        >
                          <FiRefreshCw className="animate-spin" style={{ fontSize: '12px', color: '#10B981' }} />
                          <span>{msg.content || `Processing with ${getAIModelDisplayName(box.provider, msg.model || box.model)}...`}</span>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      width: '100%',
                      margin: '0.75rem 0',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.6875rem',
                        color: isDark ? '#8E9196' : 'var(--text-muted)',
                        marginBottom: '0.375rem',
                      }}
                    >
                      <RunwareIcon size={12} color="#10B981" />
                      <span>{getAIModelDisplayName(box.provider, box.model)}</span>
                      <span>·</span>
                      <span>{formatMessageTime(msg.timestamp)}</span>
                      {msg.durationMs && <span>· {Math.round(msg.durationMs / 100) / 10}s</span>}
                    </div>

                    {/* ENHANCED IMAGES DISPLAY (Compact Small Squares Only, click to open edit view) */}
                    {((msg.enhancedImages && msg.enhancedImages.length > 0) || msg.enhancedImageUrl) ? (() => {
                      const listToDisplay: EnhancedPhotoItem[] = msg.enhancedImages && msg.enhancedImages.length > 0
                        ? msg.enhancedImages
                        : [{
                            originalUrl: msg.originalImageUrl || '',
                            enhancedUrl: msg.enhancedImageUrl!,
                            photoIndex: msg.photoIndex,
                          }];

                      return (
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.5rem',
                            width: '100%',
                            maxWidth: '680px',
                          }}
                        >
                          {/* Small Squares Row / Grid */}
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '8px',
                              alignItems: 'center',
                            }}
                          >
                            {listToDisplay.map((enhItem, i) => {
                              const isHovered = hoveredMsgImageId === `${msg.id}-${i}`;
                              const isItemApplied = enhItem.photoIndex !== undefined && Boolean(appliedPhotoMap[`${msg.id}-${enhItem.photoIndex}`]);

                              return (
                                <div
                                  key={i}
                                  onMouseEnter={() => setHoveredMsgImageId(`${msg.id}-${i}`)}
                                  onMouseLeave={() => setHoveredMsgImageId(null)}
                                  onClick={() => setLightboxModal({
                                    isOpen: true,
                                    enhancedUrl: enhItem.enhancedUrl,
                                    originalUrl: enhItem.originalUrl || msg.originalImageUrl,
                                    photoIndex: enhItem.photoIndex ?? msg.photoIndex,
                                    name: enhItem.name,
                                    promptInstructions: msg.promptInstructions,
                                    isOriginalActive: false,
                                  })}
                                  title="Click to view full generated edit size"
                                  style={{
                                    position: 'relative',
                                    width: '108px',
                                    height: '108px',
                                    borderRadius: '12px',
                                    overflow: 'hidden',
                                    border: isDark ? '1px solid rgba(255, 255, 255, 0.14)' : '1px solid var(--border-color)',
                                    cursor: 'pointer',
                                    backgroundColor: '#000',
                                    boxShadow: isDark ? '0 2px 8px rgba(0, 0, 0, 0.4)' : '0 2px 8px rgba(0, 0, 0, 0.08)',
                                    flexShrink: 0,
                                    transition: 'transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.18s ease',
                                    transform: isHovered ? 'scale(1.04)' : 'scale(1)',
                                  }}
                                >
                                  <img
                                    src={enhItem.enhancedUrl}
                                    alt={`Enhanced photo ${i + 1}`}
                                    style={{
                                      width: '100%',
                                      height: '100%',
                                      objectFit: 'cover',
                                      display: 'block',
                                    }}
                                  />

                                  {/* Photo Index Badge in top-left */}
                                  <span
                                    style={{
                                      position: 'absolute',
                                      top: '4px',
                                      left: '4px',
                                      padding: '1px 5px',
                                      borderRadius: '4px',
                                      backgroundColor: 'rgba(0, 0, 0, 0.72)',
                                      backdropFilter: 'blur(4px)',
                                      color: '#FFFFFF',
                                      fontSize: '0.625rem',
                                      fontWeight: 600,
                                      zIndex: 2,
                                    }}
                                  >
                                    {enhItem.photoIndex !== undefined ? `Photo #${enhItem.photoIndex}` : `#${i + 1}`}
                                  </span>

                                  {/* Enhanced status pill in bottom-left */}
                                  <span
                                    style={{
                                      position: 'absolute',
                                      bottom: '4px',
                                      left: '4px',
                                      padding: '1px 5px',
                                      borderRadius: '4px',
                                      backgroundColor: 'rgba(0, 0, 0, 0.72)',
                                      backdropFilter: 'blur(4px)',
                                      color: '#FFFFFF',
                                      fontSize: '0.5625rem',
                                      fontWeight: 600,
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                      zIndex: 2,
                                    }}
                                  >
                                    <HiSparkles style={{ fontSize: '9px', color: '#10B981' }} />
                                    <span>AI</span>
                                  </span>

                                  {/* Hover Overlay with Expand / Edit icon */}
                                  <div
                                    style={{
                                      position: 'absolute',
                                      inset: 0,
                                      backgroundColor: 'rgba(0, 0, 0, 0.45)',
                                      backdropFilter: 'blur(2px)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      opacity: isHovered ? 1 : 0,
                                      transition: 'opacity 0.18s ease',
                                      zIndex: 3,
                                    }}
                                  >
                                    <div
                                      style={{
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '50%',
                                        backgroundColor: 'rgba(255, 255, 255, 0.25)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#FFFFFF',
                                        fontSize: '12px',
                                      }}
                                    >
                                      <FiMaximize2 />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Assistant Action Bar below the small squares */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: '0.5rem',
                              marginTop: '2px',
                            }}
                          >
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {msg.content}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  const first = listToDisplay[0];
                                  if (first) {
                                    setLightboxModal({
                                      isOpen: true,
                                      enhancedUrl: first.enhancedUrl,
                                      originalUrl: first.originalUrl || msg.originalImageUrl,
                                      photoIndex: first.photoIndex ?? msg.photoIndex,
                                      name: first.name,
                                      promptInstructions: msg.promptInstructions,
                                      isOriginalActive: false,
                                    });
                                  }
                                }}
                                style={{
                                  height: '26px',
                                  padding: '0 0.5rem',
                                  borderRadius: '6px',
                                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'var(--bg-main)',
                                  border: '1px solid var(--border-color)',
                                  color: 'var(--text-primary)',
                                  fontSize: '0.6875rem',
                                  fontWeight: 500,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <FiMaximize2 style={{ fontSize: '11px' }} />
                                <span>Inspect full size</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })() : null}

                    {/* Text content / prompt suggestions */}
                    {msg.content && !msg.enhancedImageUrl && (
                      <div
                        style={{
                          width: '100%',
                          maxWidth: '700px',
                          backgroundColor: isDark ? '#161B22' : 'var(--bg-surface)',
                          border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid var(--border-color)',
                          borderRadius: '1.25rem',
                          padding: '1rem',
                          fontSize: '0.8125rem',
                          lineHeight: 1.6,
                          color: isDark ? '#E6EDF3' : 'var(--text-primary)',
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {msg.content}
                        {msg.isPromptProposal && (
                          <div style={{ marginTop: '0.5rem' }}>
                            <button
                              type="button"
                              onClick={() => handleAdoptPrompt(msg.proposedPrompt || msg.content)}
                              style={{
                                padding: '5px 12px',
                                borderRadius: '6px',
                                backgroundColor: '#10B981',
                                color: '#FFFFFF',
                                border: 'none',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Apply to Prompt Instructions
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Generating indicator fallback */}
              {isGenerating && !messages.some((m) => m.isPending) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.5rem 0' }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(16, 185, 129, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <RunwareIcon size={14} color="#10B981" />
                  </div>
                  <div
                    style={{
                      backgroundColor: isDark ? '#161B22' : 'var(--bg-surface)',
                      border: isDark ? 'none' : '1px solid var(--border-color)',
                      borderRadius: '12px',
                      padding: '0.5rem 0.875rem',
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                    }}
                  >
                    <FiRefreshCw className="animate-spin" style={{ fontSize: '12px', color: '#10B981' }} />
                    <span>Processing with {getAIModelDisplayName(box.provider, box.model)}...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* ========================================================= */}
          {/* CHATGPT STYLE CHAT INPUT BOX (Image 3 design)             */}
          {/* ========================================================= */}
          <div
            style={{
              padding: '0.75rem 1.25rem 1.25rem 1.25rem',
              backgroundColor: isDark ? '#0D1117' : 'var(--bg-main)',
            }}
          >
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingOver(true);
              }}
              onDragLeave={() => setIsDraggingOver(false)}
              onDrop={handleDrop}
              style={{
                width: '100%',
                maxWidth: '740px',
                margin: '0 auto',
                backgroundColor: isDark ? '#21262D' : '#F6F8FA',
                border: isDraggingOver
                  ? `2px dashed ${brandColor}`
                  : isDark
                  ? '1px solid rgba(255, 255, 255, 0.12)'
                  : '1px solid var(--border-color)',
                borderRadius: '1.25rem',
                padding: '0.75rem 0.875rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                boxShadow: isDark ? '0 6px 20px rgba(0, 0, 0, 0.4)' : '0 2px 12px rgba(0, 0, 0, 0.05)',
                transition: 'all 0.15s ease',
                position: 'relative',
              }}
            >
              {/* ATTACHED IMAGE PREVIEWS (Supports multiple photos) */}
              {attachedImages.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.625rem',
                    flexWrap: 'wrap',
                    padding: '0.25rem 0',
                  }}
                >
                  {attachedImages.map((imgItem, idx) => (
                    <div
                      key={idx}
                      style={{
                        position: 'relative',
                        width: '76px',
                        height: '76px',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid var(--border-color)',
                        backgroundColor: '#000',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                        flexShrink: 0,
                      }}
                    >
                      <img
                        src={imgItem.url}
                        alt={imgItem.name || `Attached ${idx + 1}`}
                        onClick={() => setLightboxModal({
                          isOpen: true,
                          enhancedUrl: imgItem.url,
                          photoIndex: imgItem.photoIndex,
                          isOriginalActive: true,
                        })}
                        title="Click to view full photo"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in', display: 'block' }}
                      />

                      {/* Close (X) button in top-right */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAttachedImages((prev) => prev.filter((_, i) => i !== idx));
                        }}
                        title="Remove photo"
                        style={{
                          position: 'absolute',
                          top: '3px',
                          right: '3px',
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          backgroundColor: 'rgba(0, 0, 0, 0.75)',
                          border: 'none',
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          fontSize: '10px',
                        }}
                      >
                        <FiX />
                      </button>

                      {/* Photo Index Tag */}
                      {imgItem.photoIndex !== undefined && (
                        <span
                          style={{
                            position: 'absolute',
                            bottom: '3px',
                            left: '3px',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(0, 0, 0, 0.75)',
                            color: '#FFFFFF',
                            fontSize: '0.5625rem',
                            fontWeight: 600,
                          }}
                        >
                          #{imgItem.photoIndex}
                        </span>
                      )}
                    </div>
                  ))}

                  {attachedImages.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setAttachedImages([])}
                      style={{
                        background: 'none',
                        border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid var(--border-color)',
                        borderRadius: '8px',
                        padding: '4px 8px',
                        fontSize: '0.6875rem',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        height: '28px',
                      }}
                      title="Clear all attached photos"
                    >
                      <FiX style={{ fontSize: '11px' }} />
                      <span>Clear all ({attachedImages.length})</span>
                    </button>
                  )}
                </div>
              )}

              {/* INPUT TEXTAREA */}
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  attachedImages.length > 1
                    ? `Instruct prompt for ${attachedImages.length} photos or press Enter to enhance all...`
                    : attachedImages.length === 1
                    ? 'Ask Image Studio or instruct prompt changes...'
                    : `Ask ${getAIModelDisplayName(box.provider, box.model)}...`
                }
                rows={1}
                disabled={isGenerating}
                style={{
                  width: '100%',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: isDark ? '#FFFFFF' : 'var(--text-primary)',
                  fontSize: '0.875rem',
                  fontWeight: 400,
                  lineHeight: 1.5,
                  outline: 'none',
                  resize: 'none',
                  boxSizing: 'border-box',
                  minHeight: '26px',
                  maxHeight: '200px',
                  overflowY: 'hidden',
                  fontFamily: 'inherit',
                  padding: '2px 0',
                }}
              />

              {/* BOTTOM ACTION TOOLBAR */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '4px',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {/* + Button (Attach from file) */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Upload image from computer"
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: 'none',
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                      color: isDark ? '#C9D1D9' : '#4B5563',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
                    }}
                  >
                    <FiPlus style={{ fontSize: '16px' }} />
                  </button>

                  {/* SELECT PROMPT BUTTON / DROPDOWN */}
                  <div ref={promptSelectorRef} style={{ position: 'relative' }}>
                    <button
                      type="button"
                      onClick={() => setShowPromptSelector((v) => !v)}
                      title="Select an image prompt template"
                      style={{
                        height: '28px',
                        padding: '0 0.625rem',
                        borderRadius: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid var(--border-color)',
                        backgroundColor: showPromptSelector
                          ? isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)'
                          : 'transparent',
                        color: isDark ? '#E6EDF3' : 'var(--text-primary)',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span style={{ fontSize: '11px' }}>🪄</span>
                      <span>Select Prompt</span>
                      <FiChevronDown style={{ fontSize: '11px', opacity: 0.7 }} />
                    </button>

                    {/* Prompt dropdown popover */}
                    {showPromptSelector && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: '36px',
                          left: '0',
                          width: '320px',
                          maxHeight: '260px',
                          overflowY: 'auto',
                          backgroundColor: isDark ? '#1F242C' : '#FFFFFF',
                          border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid var(--border-color)',
                          borderRadius: '12px',
                          padding: '6px',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
                          zIndex: 100,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            color: 'var(--text-muted)',
                            padding: '4px 8px',
                            borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid var(--border-color)',
                            marginBottom: '4px',
                          }}
                        >
                          Image Prompts
                        </div>
                        {imagePrompts.length === 0 ? (
                          <div style={{ padding: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            No image prompts found
                          </div>
                        ) : (
                          imagePrompts.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setInputValue(p.templateText);
                                setShowPromptSelector(false);
                                showToast(`Loaded: ${p.name}`);
                                textareaRef.current?.focus();
                              }}
                              style={{
                                padding: '6px 8px',
                                borderRadius: '6px',
                                border: 'none',
                                backgroundColor: 'transparent',
                                color: isDark ? '#FFFFFF' : 'var(--text-primary)',
                                textAlign: 'left',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '2px',
                                transition: 'background-color 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                            >
                              <span style={{ fontWeight: 600 }}>{p.name}</span>
                              <span
                                style={{
                                  fontSize: '0.6875rem',
                                  color: 'var(--text-muted)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {p.templateText}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* SEND BUTTON */}
                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  disabled={(!inputValue.trim() && attachedImages.length === 0) || isGenerating}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: (inputValue.trim() || attachedImages.length > 0) && !isGenerating ? '#10B981' : isDark ? '#2D333B' : '#E5E7EB',
                    border: 'none',
                    color: (inputValue.trim() || attachedImages.length > 0) && !isGenerating ? '#FFFFFF' : isDark ? '#6E7681' : '#9CA3AF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: (inputValue.trim() || attachedImages.length > 0) && !isGenerating ? 'pointer' : 'default',
                    transition: 'all 0.15s ease',
                  }}
                  title="Send message or enhance images"
                >
                  <FiArrowUp style={{ fontSize: '16px' }} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT SIDEBAR: Post Photos (Click or Drag into Chatbox)   */}
        {/* ========================================================= */}
        {importedPhotos && importedPhotos.length > 0 && (
          <div
            style={{
              width: '240px',
              borderLeft: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid var(--border-color)',
              backgroundColor: isDark ? '#161B22' : 'var(--bg-secondary)',
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
              zIndex: 40,
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '0.75rem 1rem',
                borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: isDark ? '#FFFFFF' : 'var(--text-primary)' }}>
                  Post Photos ({importedPhotos.length})
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={handleSelectAllPostPhotos}
                    style={{
                      fontSize: '0.625rem',
                      fontWeight: 600,
                      color: brandColor,
                      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.1)',
                      border: 'none',
                      padding: '2px 6px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                    title="Select all photos to enhance in chat"
                  >
                    Select All
                  </button>
                  {attachedImages.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAttachedPhotos}
                      style={{
                        fontSize: '0.625rem',
                        fontWeight: 500,
                        color: 'var(--text-muted)',
                        backgroundColor: 'transparent',
                        border: 'none',
                        padding: '2px 4px',
                        cursor: 'pointer',
                      }}
                      title="Clear selection"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                {attachedImages.length > 0 ? `${attachedImages.length} selected for enhancement` : 'Click photos to attach & enhance'}
              </span>
            </div>

            {/* Photos Grid */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '0.75rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '0.5rem',
                alignContent: 'start',
              }}
            >
              {importedPhotos.map((img) => {
                const url = getPhotoUrl(img);
                const isSelected = attachedImages.some((item) => item.photoIndex === img.index || item.url === url);
                const enhancedUrl = enhancedPhotosMap?.[img.index];
                const isEnhanced = Boolean(enhancedUrl);
                const displayUrl = enhancedUrl || url;

                return (
                  <div
                    key={img.index}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', url);
                      e.dataTransfer.setData('application/json', JSON.stringify({ index: img.index, url }));
                    }}
                    onClick={() => handleAttachPostPhoto(img)}
                    title={`Click or drag Photo #${img.index} to chatbox`}
                    style={{
                      position: 'relative',
                      aspectRatio: '1 / 1',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      backgroundColor: '#000',
                      border: isSelected
                        ? `2px solid ${brandColor}`
                        : isEnhanced
                        ? '1px solid rgba(16, 185, 129, 0.6)'
                        : isDark
                        ? '1px solid rgba(255, 255, 255, 0.1)'
                        : '1px solid var(--border-color)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? `0 0 10px ${brandColor}40` : 'none',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.transform = 'scale(1.03)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = 'none';
                      }
                    }}
                  >
                    <img
                      src={displayUrl}
                      alt={`Photo ${img.index}`}
                      loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                    {/* Index badge */}
                    <span
                      style={{
                        position: 'absolute',
                        top: '4px',
                        left: '4px',
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        color: '#FFFFFF',
                        fontSize: '0.625rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {img.index}
                    </span>

                    {/* Enhanced sparkle indicator */}
                    {isEnhanced && (
                      <span
                        style={{
                          position: 'absolute',
                          top: '4px',
                          right: '4px',
                          backgroundColor: 'rgba(0, 0, 0, 0.72)',
                          backdropFilter: 'blur(4px)',
                          color: '#FFFFFF',
                          border: '1px solid rgba(255, 255, 255, 0.18)',
                          borderRadius: '4px',
                          padding: '2px 4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <HiSparkles style={{ fontSize: '9px', color: '#FFFFFF' }} />
                      </span>
                    )}

                    {/* Selected checkmark badge (icon only) */}
                    {isSelected && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          backgroundColor: 'rgba(16, 185, 129, 0.18)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          pointerEvents: 'none',
                        }}
                      >
                        <span
                          style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '50%',
                            backgroundColor: '#10B981',
                            color: '#FFFFFF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 1px 4px rgba(0, 0, 0, 0.25)',
                          }}
                        >
                          <FiCheck style={{ fontSize: '14px' }} />
                        </span>
                      </div>
                    )}

                    {/* Quick view button on hover */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLightboxModal({
                          isOpen: true,
                          enhancedUrl: displayUrl,
                          originalUrl: isEnhanced ? url : undefined,
                          photoIndex: img.index,
                          isOriginalActive: false,
                        });
                      }}
                      title={`Preview Photo #${img.index} in full size`}
                      style={{
                        position: 'absolute',
                        bottom: '4px',
                        right: '4px',
                        width: '22px',
                        height: '22px',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(0, 0, 0, 0.72)',
                        border: 'none',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        zIndex: 3,
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.72)';
                      }}
                    >
                      <FiMaximize2 style={{ fontSize: '11px' }} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Lightbox / Edit View Modal Portal (clean, minimal viewer) */}
      {lightboxModal?.isOpen &&
        createPortal(
          (() => {
            const hasCompare = Boolean(lightboxModal.originalUrl);
            const isViewingOriginal = Boolean(lightboxModal.isOriginalActive && lightboxModal.originalUrl);
            const activeViewUrl = isViewingOriginal ? lightboxModal.originalUrl! : lightboxModal.enhancedUrl;
            const canApply = lightboxModal.photoIndex !== undefined && Boolean(onPhotoEnhanced);
            const isAlreadyApplied =
              lightboxModal.photoIndex !== undefined && Boolean(appliedPhotoMap[`photo-${lightboxModal.photoIndex}`]);

            const roundBtn: React.CSSProperties = {
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.12)',
              border: 'none',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '16px',
              transition: 'background-color 0.15s ease',
            };
            const toolBtn = (active = false): React.CSSProperties => ({
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              backgroundColor: active ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
              border: 'none',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '15px',
            });
            const clampZoom = (z: number) => Math.min(4, Math.max(0.5, Math.round(z * 100) / 100));

            return (
              <div
                onClick={() => setLightboxModal(null)}
                onWheel={(e) => setLightboxZoom((z) => clampZoom(z + (e.deltaY < 0 ? 0.1 : -0.1)))}
                style={{
                  position: 'fixed',
                  inset: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.88)',
                  backdropFilter: 'blur(8px)',
                  zIndex: 2000000,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4.5rem 2rem',
                  overflow: 'hidden',
                }}
              >
                {/* Top-left label */}
                <span
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    top: '16px',
                    left: '16px',
                    padding: '5px 12px',
                    borderRadius: '999px',
                    backgroundColor: 'rgba(255, 255, 255, 0.12)',
                    color: '#FFFFFF',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}
                >
                  {lightboxModal.photoIndex !== undefined ? `Photo #${lightboxModal.photoIndex}` : 'Photo'}
                  {hasCompare ? (isViewingOriginal ? ' · Original' : ' · Enhanced') : ''}
                </span>

                {/* Top-right close */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxModal(null);
                  }}
                  title="Close (Esc)"
                  aria-label="Close image viewer"
                  style={{ ...roundBtn, position: 'absolute', top: '14px', right: '16px' }}
                >
                  <FiX />
                </button>

                {/* Image */}
                <img
                  src={activeViewUrl}
                  alt={isViewingOriginal ? 'Original photo' : 'Enhanced photo'}
                  onClick={(e) => e.stopPropagation()}
                  draggable={false}
                  style={{
                    maxWidth: '92vw',
                    maxHeight: '100%',
                    width: 'auto',
                    height: 'auto',
                    objectFit: 'contain',
                    borderRadius: '6px',
                    transform: `scale(${lightboxZoom})`,
                    transition: 'transform 0.12s ease',
                    userSelect: 'none',
                  }}
                />

                {/* Bottom hint + toolbar */}
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    bottom: '16px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <span style={{ fontSize: '0.6875rem', color: 'rgba(255, 255, 255, 0.55)' }}>
                    Scroll to zoom · Esc to close
                  </span>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '5px 8px',
                      borderRadius: '999px',
                      backgroundColor: 'rgba(30, 30, 30, 0.85)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                    }}
                  >
                    <button type="button" title="Zoom out" style={toolBtn()} onClick={() => setLightboxZoom((z) => clampZoom(z - 0.25))}>
                      <FiZoomOut />
                    </button>
                    <button
                      type="button"
                      title="Reset zoom"
                      onClick={() => setLightboxZoom(1)}
                      style={{ ...toolBtn(), width: 'auto', padding: '0 6px', fontSize: '0.6875rem', fontWeight: 600 }}
                    >
                      {Math.round(lightboxZoom * 100)}%
                    </button>
                    <button type="button" title="Zoom in" style={toolBtn()} onClick={() => setLightboxZoom((z) => clampZoom(z + 0.25))}>
                      <FiZoomIn />
                    </button>

                    {(hasCompare || canApply) && (
                      <span style={{ width: '1px', height: '16px', backgroundColor: 'rgba(255, 255, 255, 0.18)', margin: '0 4px' }} />
                    )}

                    {hasCompare && (
                      <button
                        type="button"
                        title={isViewingOriginal ? 'Show enhanced' : 'Show original'}
                        style={toolBtn(!isViewingOriginal)}
                        onClick={() =>
                          setLightboxModal((prev) => (prev ? { ...prev, isOriginalActive: !isViewingOriginal } : null))
                        }
                      >
                        <HiSparkles />
                      </button>
                    )}

                    {canApply && (
                      <button
                        type="button"
                        title={isAlreadyApplied ? `Applied to Photo #${lightboxModal.photoIndex}` : `Apply to Photo #${lightboxModal.photoIndex}`}
                        style={{ ...toolBtn(isAlreadyApplied), color: isAlreadyApplied ? '#34D399' : '#FFFFFF' }}
                        onClick={() => {
                          if (lightboxModal.photoIndex === undefined || !onPhotoEnhanced) return;
                          onPhotoEnhanced(lightboxModal.photoIndex, lightboxModal.enhancedUrl);
                          setAppliedPhotoMap((prev) => ({ ...prev, [`photo-${lightboxModal.photoIndex}`]: true }));
                          setToastMessage(`Applied to Photo #${lightboxModal.photoIndex}`);
                          setTimeout(() => setToastMessage(null), 3000);
                        }}
                      >
                        <FiCheck />
                      </button>
                    )}

                    <button type="button" title="Download" style={toolBtn()} onClick={() => handleDownloadImage(activeViewUrl)}>
                      <FiDownload />
                    </button>
                  </div>
                </div>
              </div>
            );
          })(),
          document.body
        )}
    </div>
  );
};
