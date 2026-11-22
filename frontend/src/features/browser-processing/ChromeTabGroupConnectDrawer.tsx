import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  FiLayers,
  FiX,
  FiPlus,
  FiSliders,
  FiImage,
  FiFolder,
  FiFileText,
  FiCheck,
  FiArrowRight,
  FiMonitor,
  FiEye,
  FiGitBranch,
  FiPaperclip,
  FiArrowUp,
  FiCpu,
  FiUpload,
  FiTrash2,
  FiChevronDown,
  FiChevronUp,
  FiSearch,
  FiRefreshCw,
  FiMinus,
} from 'react-icons/fi';
import { Select } from '../../components/ui/Select';
import { ToggleSwitch } from '../../components/ui/ToggleSwitch';
import type { BrowserGroupItem } from './types';

interface ChromeTabGroupConnectDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  fromNodeId?: string;
  fromTitle: string;
  browserProfileName?: string;
  discoveredTabGroups: BrowserGroupItem[];
  upstreamAiBoxes: Array<{ id: string; title: string; text?: string; generatedOutput?: string; templateId?: string }>;
  condoName?: string;
  propertyImages?: Array<{ url: string; index?: number; filename?: string }>;
  enhancedImages?: Array<{ url: string; index?: number; filename?: string }>;
  onConnectTabGroup: (
    group: Partial<BrowserGroupItem> & { name: string },
    customConfig?: Record<string, any>
  ) => void;
}

export const ChromeTabGroupConnectDrawer: React.FC<ChromeTabGroupConnectDrawerProps> = ({
  isOpen,
  onClose,
  isDark,
  fromNodeId: _fromNodeId,
  fromTitle,
  browserProfileName,
  discoveredTabGroups = [],
  upstreamAiBoxes = [],
  condoName = '',
  propertyImages = [],
  enhancedImages = [],
  onConnectTabGroup,
}) => {
  // Navigation: 'custom_flow' vs 'discovered_groups'
  const [activeTab, setActiveTab] = useState<'custom_flow' | 'discovered_groups'>('custom_flow');

  // Custom Flow Configuration State
  const [flowName, setFlowName] = useState<string>(() => `Flow-${Math.floor(1000 + Math.random() * 9000)}`);
  const [showTemplatesDropdown, setShowTemplatesDropdown] = useState<boolean>(false);
  const [tabGroupMode, setTabGroupMode] = useState<'generate' | 'enhance'>('generate');

  // Generate Mode Settings
  const [useReferenceImage, setUseReferenceImage] = useState<boolean>(true);
  const [referenceImageUrl, setReferenceImageUrl] = useState<string>('');
  const [referenceImageName, setReferenceImageName] = useState<string>('');
  const [referenceFolderName, setReferenceFolderName] = useState<string>('Reference Layout');
  const [showFolderImagePicker, setShowFolderImagePicker] = useState<boolean>(false);
  const refFileInputRef = useRef<HTMLInputElement | null>(null);

  // Main Condo Photos Toggle & Local Base Directory State
  const [useCondoImages, setUseCondoImages] = useState<boolean>(true);
  const [availableCondoFolders, setAvailableCondoFolders] = useState<string[]>([]);
  const [baseCondoDirectory, setBaseCondoDirectory] = useState<string>('/Users/zinwaishine/Desktop/Condo Building');
  const [activeFolderDropdownStepId, setActiveFolderDropdownStepId] = useState<string | null>(null);
  const [folderSearchFilter, setFolderSearchFilter] = useState<string>('');

  // Child Attachment Groups inside Condo Photos
  const [attachmentSteps, setAttachmentSteps] = useState<Array<{
    id: string;
    title: string;
    count: number;
    sourceType: 'folder' | 'upload' | 'enhanced';
    folderName: string;
    folderImages?: Array<{ filename: string; data_url?: string; full_path?: string; index?: number }>;
    imageSelection?: string;
    uploadedUrls?: string[];
    enabled: boolean;
  }>>([
    {
      id: 'group-1',
      title: 'Group 1',
      count: 1,
      sourceType: 'folder',
      folderName: condoName || '',
      imageSelection: '',
      enabled: true,
    },
  ]);

  const filteredCondoFolders = useMemo(() => {
    if (!folderSearchFilter.trim()) return [];
    const q = folderSearchFilter.toLowerCase();
    return availableCondoFolders.filter((f) => f.toLowerCase().includes(q)).slice(0, 25);
  }, [availableCondoFolders, folderSearchFilter]);

  const loadCondoFolders = async (dir: string = baseCondoDirectory) => {
    try {
      const resp = await fetch(`http://127.0.0.1:9224/condo-folders?base_dir=${encodeURIComponent(dir)}`);
      const data = await resp.json();
      if (data?.status === 'success' && Array.isArray(data.folders)) {
        setAvailableCondoFolders(data.folders);
        if (data.base_dir) setBaseCondoDirectory(data.base_dir);
      }
    } catch (e) {
      console.warn('Failed to load condo folders:', e);
    }
  };

  const fetchImagesForStep = async (stepId: string, condoFolderName: string, baseDir: string = baseCondoDirectory) => {
    if (!condoFolderName?.trim()) return;
    try {
      const resp = await fetch(
        `http://127.0.0.1:9224/condo-images?condo_name=${encodeURIComponent(condoFolderName)}&base_dir=${encodeURIComponent(baseDir)}`
      );
      const data = await resp.json();
      if (data?.status === 'success' && Array.isArray(data.images)) {
        setAttachmentSteps((prev) =>
          prev.map((s) =>
            s.id === stepId
              ? {
                  ...s,
                  folderName: data.matched_folder || condoFolderName,
                  folderImages: data.images,
                  count: Math.min(s.count, data.images.length || 1),
                }
              : s
          )
        );
      }
    } catch (e) {
      console.warn('Failed to fetch condo images for step:', e);
    }
  };

  useEffect(() => {
    loadCondoFolders();
  }, []);

  // On mount or when condo folders are loaded, load images for initial folder step
  useEffect(() => {
    attachmentSteps.forEach((s) => {
      if (s.sourceType === 'folder' && s.folderName && (!s.folderImages || s.folderImages.length === 0)) {
        fetchImagesForStep(s.id, s.folderName);
      }
    });
  }, [availableCondoFolders]);

  const totalCondoImagesCount = useMemo(() => {
    return attachmentSteps.reduce((acc, s) => acc + (s.enabled ? s.count : 0), 0);
  }, [attachmentSteps]);

  const handleAddStep = () => {
    if (totalCondoImagesCount >= 10) return;
    const nextIdx = attachmentSteps.length + 1;
    const newStepId = `group-${Date.now()}`;
    const initialFolder = condoName || '';
    setAttachmentSteps((prev) => [
      ...prev,
      {
        id: newStepId,
        title: `Group ${nextIdx}`,
        count: 1,
        sourceType: 'folder',
        folderName: initialFolder,
        imageSelection: '',
        enabled: true,
      },
    ]);
    if (initialFolder) {
      fetchImagesForStep(newStepId, initialFolder);
    }
  };

  const handleRemoveStep = (id: string) => {
    setAttachmentSteps((prev) => prev.filter((s) => s.id !== id));
  };

  const handleUpdateStep = (
    id: string,
    updates: Partial<{
      title: string;
      count: number;
      sourceType: 'folder' | 'upload' | 'enhanced';
      folderName: string;
      folderImages?: Array<{ filename: string; data_url?: string; full_path?: string; index?: number }>;
      imageSelection?: string;
      uploadedUrls?: string[];
      enabled: boolean;
    }>
  ) => {
    setAttachmentSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  };

  const renderCountStepper = (s: typeof attachmentSteps[0]) => {
    const otherGroupsCount = attachmentSteps
      .filter((other) => other.id !== s.id && other.enabled)
      .reduce((acc, other) => acc + other.count, 0);
    const maxAllowed = Math.max(1, 10 - otherGroupsCount);
    const isAtMax = s.count >= maxAllowed;

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
        <span style={{ fontSize: '0.625rem', color: isDark ? '#8B949E' : '#64748B' }}>Attach:</span>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            backgroundColor: isDark ? '#161B22' : '#FFFFFF',
            borderRadius: '4px',
            border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
            height: '24px',
            padding: '0 2px',
          }}
        >
          <button
            type="button"
            disabled={s.count <= 1}
            onClick={() => handleUpdateStep(s.id, { count: Math.max(1, s.count - 1) })}
            title="Decrease count"
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '3px',
              border: 'none',
              backgroundColor: 'transparent',
              color: s.count <= 1 ? (isDark ? '#484F58' : '#94A3B8') : (isDark ? '#C9D1D9' : '#334155'),
              cursor: s.count <= 1 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              transition: 'all 0.12s ease',
            }}
            onMouseEnter={(e) => {
              if (s.count > 1) {
                e.currentTarget.style.backgroundColor = isDark ? '#21262D' : '#E2E8F0';
                e.currentTarget.style.color = isDark ? '#F0F6FC' : '#0F172A';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = s.count <= 1 ? (isDark ? '#484F58' : '#94A3B8') : (isDark ? '#C9D1D9' : '#334155');
            }}
          >
            <FiMinus size={10} />
          </button>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={s.count}
            onChange={(e) => {
              const val = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10);
              handleUpdateStep(s.id, { count: isNaN(val) ? 1 : Math.min(maxAllowed, Math.max(1, val)) });
            }}
            style={{
              width: '22px',
              height: '20px',
              textAlign: 'center',
              border: 'none',
              backgroundColor: 'transparent',
              color: isDark ? '#F0F6FC' : '#0F172A',
              fontSize: '0.75rem',
              fontWeight: 600,
              outline: 'none',
              padding: 0,
              margin: 0,
              appearance: 'none',
              MozAppearance: 'textfield',
            }}
          />
          <button
            type="button"
            disabled={isAtMax}
            onClick={() => handleUpdateStep(s.id, { count: Math.min(maxAllowed, s.count + 1) })}
            title={isAtMax ? `Max 10 total photos across all groups (${totalCondoImagesCount}/10)` : 'Increase count'}
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '3px',
              border: 'none',
              backgroundColor: 'transparent',
              color: isAtMax ? (isDark ? '#484F58' : '#94A3B8') : (isDark ? '#C9D1D9' : '#334155'),
              cursor: isAtMax ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              transition: 'all 0.12s ease',
            }}
            onMouseEnter={(e) => {
              if (!isAtMax) {
                e.currentTarget.style.backgroundColor = isDark ? '#21262D' : '#E2E8F0';
                e.currentTarget.style.color = isDark ? '#F0F6FC' : '#0F172A';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = isAtMax ? (isDark ? '#484F58' : '#94A3B8') : (isDark ? '#C9D1D9' : '#334155');
            }}
          >
            <FiPlus size={10} />
          </button>
        </div>
      </div>
    );
  };

  // File upload and removal handlers
  const handleReferenceImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) return;
      setReferenceImageUrl(dataUrl);
      setReferenceImageName(file.name);
      setShowFolderImagePicker(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveReferenceImage = () => {
    setReferenceImageUrl('');
    setReferenceImageName('');
  };

  // Prompt Link
  const [selectedPromptSource, setSelectedPromptSource] = useState<'upstream_ai' | 'custom'>('upstream_ai');
  const [selectedUpstreamAiId, setSelectedUpstreamAiId] = useState<string>(() => {
    const heroMatch = upstreamAiBoxes.find(
      (b) => b.title.toLowerCase().includes('hero') || b.title.toLowerCase().includes('prompt')
    );
    return heroMatch?.id || upstreamAiBoxes[0]?.id || '';
  });
  const [customPromptText, setCustomPromptText] = useState<string>(
    'Create an attractive facebook property advertisement using the attached layout and condo photos.'
  );

  // Enhance Mode Settings
  const [workerTabsCount, setWorkerTabsCount] = useState<number>(4);
  const [enhancePromptPreset, setEnhancePromptPreset] = useState<string>('photo_retouch');
  const [enhancePhotoSource, setEnhancePhotoSource] = useState<'all' | 'hero_only'>('all');

  // Quick preset templates for flow name
  const flowNamePresets = [
    { label: 'FB Hero', mode: 'generate' as const },
    { label: 'Enhance IMG', mode: 'enhance' as const },
    { label: 'Tiktok - BH Hero', mode: 'generate' as const },
    { label: 'Marketplace Hero', mode: 'generate' as const },
    { label: 'Facilities IMG', mode: 'generate' as const },
  ];

  // Upstream AI box selected info
  const selectedAiBox = useMemo(() => {
    return upstreamAiBoxes.find((b) => b.id === selectedUpstreamAiId) || upstreamAiBoxes[0];
  }, [upstreamAiBoxes, selectedUpstreamAiId]);

  // Clean prompt options without any emojis
  const cleanPromptOptions = useMemo(() => {
    return upstreamAiBoxes.map((b) => {
      const cleanTitle = b.title.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{27BF}]/gu, '').trim();
      return {
        label: `${cleanTitle} (AI Model)`,
        value: b.id,
      };
    });
  }, [upstreamAiBoxes]);

  // Image calculations
  const effectiveRefPhotosCount = useReferenceImage ? 1 : 0;
  const totalStepPhotos = useMemo(() => {
    if (!useCondoImages) return 0;
    return attachmentSteps
      .filter((s) => s.enabled)
      .reduce((sum, s) => sum + Math.min(10, Math.max(1, s.count)), 0);
  }, [attachmentSteps, useCondoImages]);
  const totalCompositePhotos = effectiveRefPhotosCount + totalStepPhotos;

  // Handle Create Flow Click
  const handleCreateAndConnectFlow = () => {
    const finalName = flowName.trim() || (tabGroupMode === 'generate' ? 'FB Hero' : 'Enhance IMG');
    const enabledSteps = (tabGroupMode === 'generate' && useCondoImages) ? attachmentSteps.filter((s) => s.enabled) : [];
    const primaryFolderStep = enabledSteps.find((s) => s.sourceType === 'folder');
    const primaryEnhancedStep = enabledSteps.find((s) => s.sourceType === 'enhanced');

    const customConfig: Record<string, any> = {
      title: finalName,
      browserGroupName: finalName,
      tabGroupMode,
      processKind: tabGroupMode === 'generate' ? 'generate_image' : 'enhance_images',
      workerTabCount: tabGroupMode === 'generate' ? 1 : workerTabsCount,
      workerCount: tabGroupMode === 'generate' ? 1 : workerTabsCount,
      stagingMode: tabGroupMode === 'generate' ? 'direct_tab2' : undefined,
      useReferenceImage: tabGroupMode === 'generate' ? useReferenceImage : false,
      referenceImage: referenceImageUrl || undefined,
      referenceImageName: referenceImageName || undefined,
      referenceFolderName: referenceFolderName || undefined,
      imageAttachmentSteps: enabledSteps,
      totalAttachmentPhotos: tabGroupMode === 'generate' ? totalCompositePhotos : 0,
      // Backwards-compatible fields:
      useCondoImages: tabGroupMode === 'generate' ? useCondoImages : false,
      condoImagesCount: tabGroupMode === 'generate' ? (primaryFolderStep ? primaryFolderStep.count : 0) : 0,
      condoFolderName: tabGroupMode === 'generate' ? (primaryFolderStep?.folderName || condoName || 'Regent Home Bangna') : undefined,
      useEnhancedImages: tabGroupMode === 'generate' ? Boolean(primaryEnhancedStep) : false,
      enhancedImagesSource: 'enhanced',
      enhancedImagesCount: tabGroupMode === 'generate' ? (primaryEnhancedStep ? primaryEnhancedStep.count : 0) : 0,
      selectedUpstreamAiId: selectedPromptSource === 'upstream_ai' ? selectedUpstreamAiId : undefined,
      promptSourceMode: selectedPromptSource,
      browserCustomPrompt: selectedPromptSource === 'custom' ? customPromptText : undefined,
    };

    onConnectTabGroup(
      {
        name: finalName,
        tabs_count: tabGroupMode === 'generate' ? 1 : workerTabsCount,
      },
      customConfig
    );
  };

  if (!isOpen) return null;

  return (
    <aside
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: 'min(980px, 52vw)',
        minWidth: '720px',
        maxWidth: '100%',
        backgroundColor: isDark ? '#0D1117' : '#FFFFFF',
        borderLeft: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
        boxShadow: isDark
          ? '-6px 0 24px rgba(0, 0, 0, 0.45)'
          : '-2px 0 16px rgba(0, 0, 0, 0.06)',
        zIndex: 170,
        display: 'flex',
        flexDirection: 'column',
        animation: 'sidebarSlideIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* ── HEADER ── */}
      <div
        style={{
          padding: '0.75rem 1.25rem',
          borderBottom: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: isDark ? '#161B22' : '#FFFFFF',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F1F5F9',
              border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
              color: isDark ? '#E6EDF3' : '#1E293B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <FiGitBranch size={16} />
          </div>
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: '0.875rem',
                fontWeight: 600,
                color: isDark ? '#F0F6FC' : '#0F172A',
                letterSpacing: '-0.01em',
              }}
            >
              Connect Chrome Tab Group
            </h3>
            <p style={{ margin: '1px 0 0', fontSize: '0.6875rem', color: isDark ? '#8B949E' : '#64748B' }}>
              Configure browser workflow for {browserProfileName || fromTitle}
            </p>
          </div>
        </div>

        {/* View Switcher & Close */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: isDark ? '#0D1117' : '#F1F5F9',
              borderRadius: '6px',
              padding: '2px',
              border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('custom_flow')}
              style={{
                padding: '4px 10px',
                borderRadius: '4px',
                fontSize: '0.6875rem',
                fontWeight: activeTab === 'custom_flow' ? 600 : 500,
                backgroundColor: activeTab === 'custom_flow'
                  ? (isDark ? '#21262D' : '#FFFFFF')
                  : 'transparent',
                color: activeTab === 'custom_flow'
                  ? (isDark ? '#F0F6FC' : '#0F172A')
                  : (isDark ? '#8B949E' : '#64748B'),
                border: activeTab === 'custom_flow'
                  ? (isDark ? '1px solid #30363D' : '1px solid #CBD5E1')
                  : '1px solid transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.12s ease',
              }}
            >
              <FiPlus size={11} />
              <span>Create Flow</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('discovered_groups')}
              style={{
                padding: '4px 10px',
                borderRadius: '4px',
                fontSize: '0.6875rem',
                fontWeight: activeTab === 'discovered_groups' ? 600 : 500,
                backgroundColor: activeTab === 'discovered_groups'
                  ? (isDark ? '#21262D' : '#FFFFFF')
                  : 'transparent',
                color: activeTab === 'discovered_groups'
                  ? (isDark ? '#F0F6FC' : '#0F172A')
                  : (isDark ? '#8B949E' : '#64748B'),
                border: activeTab === 'discovered_groups'
                  ? (isDark ? '1px solid #30363D' : '1px solid #CBD5E1')
                  : '1px solid transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.12s ease',
              }}
            >
              <FiLayers size={11} />
              <span>Discovered ({discoveredTabGroups.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            title="Close (Esc)"
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '6px',
              border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
              backgroundColor: 'transparent',
              color: isDark ? '#8B949E' : '#64748B',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.12s ease',
            }}
          >
            <FiX size={14} />
          </button>
        </div>
      </div>

      {/* ── TWO-COLUMN BODY ── */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '50% 50%',
          overflow: 'hidden',
        }}
      >
        {/* ── LEFT COLUMN: FEATURES AND CONTROLS ── */}
        <div
          style={{
            overflowY: 'auto',
            padding: '1.25rem',
            borderRight: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            backgroundColor: isDark ? '#0D1117' : '#FFFFFF',
          }}
        >
          {activeTab === 'discovered_groups' ? (
            /* VIEW 1: DISCOVERED TAB GROUPS LIST */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: isDark ? '#8B949E' : '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Discovered in {browserProfileName || fromTitle}
                </span>
                <span style={{ fontSize: '0.625rem', color: isDark ? '#8B949E' : '#64748B' }}>
                  {discoveredTabGroups.length} available groups
                </span>
              </div>

              {discoveredTabGroups.map((g) => (
                <div
                  key={g.id || g.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '6px',
                    border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                    backgroundColor: isDark ? '#161B22' : '#F8FAFC',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '5px',
                        backgroundColor: isDark ? '#21262D' : '#F1F5F9',
                        border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                        color: isDark ? '#F0F6FC' : '#1E293B',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <FiLayers size={13} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.78125rem', fontWeight: 600, color: isDark ? '#F0F6FC' : '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {g.name}
                        </span>
                        <span style={{ fontSize: '0.5625rem', padding: '1px 5px', borderRadius: '3px', backgroundColor: isDark ? '#21262D' : '#E2E8F0', color: isDark ? '#8B949E' : '#64748B', fontWeight: 600 }}>
                          {g.tabs?.length || g.tabs_count || 0} tabs
                        </span>
                      </div>
                      <div style={{ fontSize: '0.625rem', color: isDark ? '#8B949E' : '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(g.tabs || []).map((t) => t.title || t.url).slice(0, 2).join(' • ') || 'Active worker tabs'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setFlowName(g.name);
                        setTabGroupMode(g.name.toLowerCase().includes('enhance') ? 'enhance' : 'generate');
                        setActiveTab('custom_flow');
                      }}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '0.625rem',
                        fontWeight: 500,
                        backgroundColor: 'transparent',
                        color: isDark ? '#8B949E' : '#64748B',
                        border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                        cursor: 'pointer',
                      }}
                    >
                      Customize
                    </button>
                    <button
                      type="button"
                      onClick={() => onConnectTabGroup(g)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '4px',
                        fontSize: '0.625rem',
                        fontWeight: 600,
                        backgroundColor: '#2563EB',
                        border: '1px solid #1D4ED8',
                        color: '#FFFFFF',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <FiPlus size={11} /> Connect
                    </button>
                  </div>
                </div>
              ))}

              {discoveredTabGroups.length === 0 && (
                <div
                  style={{
                    padding: '2rem',
                    textAlign: 'center',
                    border: isDark ? '1px dashed #30363D' : '1px dashed #CBD5E1',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    color: isDark ? '#8B949E' : '#64748B',
                  }}
                >
                  No tab groups open in Chrome yet. Use the Create Flow tab to build one.
                </div>
              )}
            </div>
          ) : (
            /* VIEW 2: CUSTOM FLOW BUILDER */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* 1. Flow Name & Use Template Button */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: isDark ? '#8B949E' : '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Flow Name
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowTemplatesDropdown(!showTemplatesDropdown)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '0.65625rem',
                      fontWeight: 500,
                      backgroundColor: showTemplatesDropdown
                        ? (isDark ? '#21262D' : '#E2E8F0')
                        : (isDark ? '#161B22' : '#F1F5F9'),
                      color: showTemplatesDropdown
                        ? (isDark ? '#58A6FF' : '#2563EB')
                        : (isDark ? '#C9D1D9' : '#475569'),
                      border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                    }}
                  >
                    <FiLayers size={11} style={{ color: isDark ? '#58A6FF' : '#2563EB' }} />
                    <span>Use Template</span>
                    <FiChevronDown
                      size={11}
                      style={{
                        transform: showTemplatesDropdown ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.15s ease',
                      }}
                    />
                  </button>
                </div>

                <input
                  type="text"
                  value={flowName}
                  onChange={(e) => setFlowName(e.target.value)}
                  placeholder="e.g. Flow-4821, FB Hero, Enhance IMG"
                  style={{
                    width: '100%',
                    height: '34px',
                    padding: '0 10px',
                    borderRadius: '6px',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                    backgroundColor: isDark ? '#161B22' : '#FFFFFF',
                    color: isDark ? '#F0F6FC' : '#0F172A',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />

                {/* Template Selection Dropdown */}
                {showTemplatesDropdown && (
                  <>
                    <div
                      style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                      onClick={() => setShowTemplatesDropdown(false)}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: '64px',
                        right: 0,
                        left: 0,
                        zIndex: 50,
                        borderRadius: '6px',
                        border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                        backgroundColor: isDark ? '#161B22' : '#FFFFFF',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                        padding: '6px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '3px',
                      }}
                    >
                      <div style={{ padding: '4px 6px', fontSize: '0.625rem', fontWeight: 600, color: isDark ? '#8B949E' : '#64748B', textTransform: 'uppercase' }}>
                        Choose a Template
                      </div>
                      {[
                        { label: 'FB Hero', mode: 'generate' as const, desc: 'Facebook composite real-estate hero post' },
                        { label: 'Enhance IMG', mode: 'enhance' as const, desc: 'Batch architectural room photo retouch' },
                        { label: 'Tiktok Hero', mode: 'generate' as const, desc: 'Vertical video/slideshow hero format' },
                        { label: 'Marketplace', mode: 'generate' as const, desc: 'Facebook marketplace multi-photo card' },
                        { label: 'Facilities', mode: 'generate' as const, desc: 'Building pool, gym and facility layout' },
                      ].map((t) => {
                        const isSelected = flowName === t.label;
                        return (
                          <button
                            key={t.label}
                            type="button"
                            onClick={() => {
                              setFlowName(t.label);
                              setTabGroupMode(t.mode);
                              setShowTemplatesDropdown(false);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '6px 10px',
                              borderRadius: '4px',
                              border: 'none',
                              backgroundColor: isSelected
                                ? (isDark ? '#21262D' : '#E2E8F0')
                                : 'transparent',
                              color: isSelected ? (isDark ? '#58A6FF' : '#2563EB') : (isDark ? '#F0F6FC' : '#0F172A'),
                              cursor: 'pointer',
                              textAlign: 'left',
                              transition: 'all 0.12s ease',
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: isSelected ? 600 : 500 }}>
                                {t.label}
                              </span>
                              <span style={{ fontSize: '0.59375rem', color: isDark ? '#8B949E' : '#64748B' }}>
                                {t.desc}
                              </span>
                            </div>
                            <span
                              style={{
                                fontSize: '0.59375rem',
                                padding: '2px 6px',
                                borderRadius: '3px',
                                backgroundColor: isDark ? '#0D1117' : '#F1F5F9',
                                color: isDark ? '#8B949E' : '#64748B',
                                fontWeight: 500,
                                textTransform: 'capitalize',
                              }}
                            >
                              {t.mode}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* 2. Action Mode Switcher */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: isDark ? '#8B949E' : '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Action Mode
                </label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setTabGroupMode('generate')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: tabGroupMode === 'generate' ? 600 : 400,
                      backgroundColor: tabGroupMode === 'generate'
                        ? (isDark ? '#21262D' : '#FFFFFF')
                        : 'transparent',
                      color: tabGroupMode === 'generate'
                        ? (isDark ? '#F0F6FC' : '#0F172A')
                        : (isDark ? '#8B949E' : '#64748B'),
                      border: tabGroupMode === 'generate'
                        ? (isDark ? '1px solid #58A6FF' : '1px solid #2563EB')
                        : (isDark ? '1px solid #30363D' : '1px solid #E2E8F0'),
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                    }}
                  >
                    <FiImage size={14} style={{ color: tabGroupMode === 'generate' ? '#58A6FF' : (isDark ? '#8B949E' : '#64748B'), flexShrink: 0 }} />
                    <span>Generate Image</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTabGroupMode('enhance')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: tabGroupMode === 'enhance' ? 600 : 400,
                      backgroundColor: tabGroupMode === 'enhance'
                        ? (isDark ? '#21262D' : '#FFFFFF')
                        : 'transparent',
                      color: tabGroupMode === 'enhance'
                        ? (isDark ? '#F0F6FC' : '#0F172A')
                        : (isDark ? '#8B949E' : '#64748B'),
                      border: tabGroupMode === 'enhance'
                        ? (isDark ? '1px solid #58A6FF' : '1px solid #2563EB')
                        : (isDark ? '1px solid #30363D' : '1px solid #E2E8F0'),
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                    }}
                  >
                    <FiSliders size={14} style={{ color: tabGroupMode === 'enhance' ? '#58A6FF' : (isDark ? '#8B949E' : '#64748B'), flexShrink: 0 }} />
                    <span>Enhance Images</span>
                  </button>
                </div>
              </div>

              {/* 3. Pipeline Settings */}
              {tabGroupMode === 'generate' ? (
                /* GENERATE MODE PIPELINE */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* Item 1: Reference Layout */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '1rem', borderBottom: isDark ? '1px solid #21262D' : '1px solid #F1F5F9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FiImage size={15} style={{ color: isDark ? '#8B949E' : '#64748B', flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: isDark ? '#F0F6FC' : '#0F172A' }}>
                            Reference Layout
                          </div>
                          <div style={{ fontSize: '0.625rem', color: isDark ? '#8B949E' : '#64748B' }}>
                            Example design attached first to guide composition
                          </div>
                        </div>
                      </div>
                      <ToggleSwitch
                        checked={useReferenceImage}
                        onChange={(val) => setUseReferenceImage(val)}
                        size="sm"
                        activeColor="#2563EB"
                      />
                    </div>

                    {useReferenceImage && (
                      <div style={{ paddingLeft: '23px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {/* Hidden native file input */}
                        <input
                          type="file"
                          ref={refFileInputRef}
                          accept="image/*"
                          onChange={handleReferenceImageUpload}
                          style={{ display: 'none' }}
                        />

                        {referenceImageUrl ? (
                          /* Attached Preview Bar: Cool, sleek card layout */
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              backgroundColor: isDark ? '#161B22' : '#F8FAFC',
                              border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                              gap: '10px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                              <img
                                src={referenceImageUrl}
                                alt="Reference"
                                style={{
                                  width: '36px',
                                  height: '36px',
                                  borderRadius: '5px',
                                  objectFit: 'cover',
                                  border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                                  flexShrink: 0,
                                }}
                              />
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div
                                  style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    color: isDark ? '#F0F6FC' : '#0F172A',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {referenceImageName || 'Reference Photo'}
                                </div>
                                <div
                                  style={{
                                    fontSize: '0.625rem',
                                    color: isDark ? '#8B949E' : '#64748B',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    marginTop: '1px',
                                  }}
                                >
                                  Attached 1st in ChatGPT
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                              <button
                                type="button"
                                onClick={() => refFileInputRef.current?.click()}
                                title="Change reference photo"
                                style={{
                                  height: '28px',
                                  padding: '0 8px',
                                  borderRadius: '5px',
                                  fontSize: '0.6875rem',
                                  fontWeight: 500,
                                  backgroundColor: isDark ? '#21262D' : '#F1F5F9',
                                  color: isDark ? '#E6EDF3' : '#334155',
                                  border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  transition: 'all 0.12s ease',
                                }}
                              >
                                <FiUpload size={11} />
                                <span>Change</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowFolderImagePicker(!showFolderImagePicker)}
                                title="Pick from folder"
                                style={{
                                  height: '28px',
                                  padding: '0 8px',
                                  borderRadius: '5px',
                                  fontSize: '0.6875rem',
                                  fontWeight: 500,
                                  backgroundColor: isDark ? '#21262D' : '#F1F5F9',
                                  color: isDark ? '#E6EDF3' : '#334155',
                                  border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  transition: 'all 0.12s ease',
                                }}
                              >
                                <FiFolder size={11} />
                                <span>Folder</span>
                              </button>
                              <button
                                type="button"
                                onClick={handleRemoveReferenceImage}
                                title="Remove reference photo"
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '5px',
                                  backgroundColor: isDark ? 'rgba(248, 81, 73, 0.08)' : '#FEF2F2',
                                  color: isDark ? '#F85149' : '#DC2626',
                                  border: isDark ? '1px solid rgba(248, 81, 73, 0.25)' : '1px solid #FECACA',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: 0,
                                  transition: 'all 0.12s ease',
                                }}
                              >
                                <FiTrash2 size={13} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* No Reference Image Selected Yet: Clean input + Folder & Upload action buttons */
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                              type="text"
                              value={referenceImageUrl}
                              onChange={(e) => {
                                setReferenceImageUrl(e.target.value);
                                setReferenceImageName('URL Image');
                              }}
                              placeholder="Paste image URL or choose..."
                              style={{
                                flex: 1,
                                minWidth: 0,
                                height: '32px',
                                padding: '0 10px',
                                borderRadius: '4px',
                                border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                                backgroundColor: isDark ? '#161B22' : '#FFFFFF',
                                color: isDark ? '#F0F6FC' : '#0F172A',
                                fontSize: '0.6875rem',
                                outline: 'none',
                                boxSizing: 'border-box',
                              }}
                            />

                            <button
                              type="button"
                              onClick={() => setShowFolderImagePicker(!showFolderImagePicker)}
                              title="Choose reference photo from property images"
                              style={{
                                height: '32px',
                                padding: '0 10px',
                                borderRadius: '4px',
                                fontSize: '0.65625rem',
                                fontWeight: 500,
                                backgroundColor: isDark ? '#21262D' : '#E2E8F0',
                                color: isDark ? '#E6EDF3' : '#334155',
                                border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                              }}
                            >
                              <FiFolder size={12} />
                              <span>Folder</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => refFileInputRef.current?.click()}
                              title="Upload reference photo from local drive"
                              style={{
                                height: '32px',
                                padding: '0 10px',
                                borderRadius: '4px',
                                fontSize: '0.65625rem',
                                fontWeight: 500,
                                backgroundColor: isDark ? '#21262D' : '#E2E8F0',
                                color: isDark ? '#E6EDF3' : '#334155',
                                border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                              }}
                            >
                              <FiUpload size={12} />
                              <span>Upload</span>
                            </button>
                          </div>
                        )}

                        {/* Collapsible Folder & Image Picker Drawer */}
                        {showFolderImagePicker && (
                          <div
                            style={{
                              padding: '10px',
                              borderRadius: '6px',
                              border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                              backgroundColor: isDark ? '#161B22' : '#F8FAFC',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: isDark ? '#F0F6FC' : '#0F172A' }}>
                                Choose Image from Folder
                              </span>
                              <button
                                type="button"
                                onClick={() => setShowFolderImagePicker(false)}
                                style={{
                                  border: 'none',
                                  background: 'none',
                                  color: isDark ? '#8B949E' : '#64748B',
                                  cursor: 'pointer',
                                  padding: '2px',
                                }}
                              >
                                <FiX size={12} />
                              </button>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '0.625rem', color: isDark ? '#8B949E' : '#64748B' }}>Folder:</span>
                              <input
                                type="text"
                                value={referenceFolderName}
                                onChange={(e) => setReferenceFolderName(e.target.value)}
                                placeholder="e.g. Reference Layout"
                                style={{
                                  flex: 1,
                                  height: '26px',
                                  padding: '0 8px',
                                  borderRadius: '4px',
                                  border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                                  backgroundColor: isDark ? '#0D1117' : '#FFFFFF',
                                  color: isDark ? '#F0F6FC' : '#0F172A',
                                  fontSize: '0.65625rem',
                                  outline: 'none',
                                }}
                              />
                            </div>

                            {propertyImages.length > 0 ? (
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', maxHeight: '140px', overflowY: 'auto' }}>
                                {propertyImages.map((img, i) => {
                                  const isSelected = referenceImageUrl === img.url;
                                  return (
                                    <button
                                      key={`ref-pick-${i}`}
                                      type="button"
                                      onClick={() => {
                                        setReferenceImageUrl(img.url);
                                        setReferenceImageName(img.filename || `Photo #${img.index || i + 1}`);
                                        setShowFolderImagePicker(false);
                                      }}
                                      style={{
                                        padding: 0,
                                        borderRadius: '4px',
                                        border: isSelected
                                          ? (isDark ? '2px solid #58A6FF' : '2px solid #2563EB')
                                          : (isDark ? '1px solid #30363D' : '1px solid #CBD5E1'),
                                        overflow: 'hidden',
                                        position: 'relative',
                                        aspectRatio: '1',
                                        cursor: 'pointer',
                                        backgroundColor: '#1E293B',
                                      }}
                                    >
                                      <img src={img.url} alt={`Option ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                      <span
                                        style={{
                                          position: 'absolute',
                                          bottom: 2,
                                          right: 2,
                                          backgroundColor: 'rgba(0,0,0,0.75)',
                                          color: '#fff',
                                          fontSize: '8px',
                                          padding: '1px 3px',
                                          borderRadius: '2px',
                                          fontWeight: 600,
                                        }}
                                      >
                                        #{img.index || i + 1}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.625rem', color: isDark ? '#8B949E' : '#64748B', textAlign: 'center', padding: '10px 0' }}>
                                No images in folder yet. Click Upload to attach from your computer.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Item 2: Condo Photos (Main Title) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '1rem', borderBottom: isDark ? '1px solid #21262D' : '1px solid #F1F5F9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FiFolder size={15} style={{ color: isDark ? '#8B949E' : '#64748B', flexShrink: 0 }} />
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: isDark ? '#F0F6FC' : '#0F172A' }}>
                              Condo Photos
                            </span>
                            <span
                              style={{
                                fontSize: '0.59375rem',
                                fontWeight: 600,
                                color: totalCondoImagesCount >= 10 ? (isDark ? '#F85149' : '#DC2626') : (isDark ? '#58A6FF' : '#2563EB'),
                                backgroundColor: totalCondoImagesCount >= 10
                                  ? (isDark ? 'rgba(248, 81, 73, 0.15)' : '#FEF2F2')
                                  : (isDark ? 'rgba(88, 166, 255, 0.1)' : '#EFF6FF'),
                                padding: '1px 6px',
                                borderRadius: '10px',
                                border: totalCondoImagesCount >= 10
                                  ? (isDark ? '1px solid rgba(248, 81, 73, 0.3)' : '1px solid #FECACA')
                                  : 'none',
                              }}
                            >
                              {totalCondoImagesCount}/10 Total
                            </span>
                          </div>
                          <div style={{ fontSize: '0.625rem', color: isDark ? '#8B949E' : '#64748B' }}>
                            Exterior & facility photos (10 max combined across all groups)
                          </div>
                        </div>
                      </div>
                      <ToggleSwitch
                        checked={useCondoImages}
                        onChange={(val) => setUseCondoImages(val)}
                        size="sm"
                        activeColor="#2563EB"
                      />
                    </div>

                    {useCondoImages && (
                      <div style={{ paddingLeft: '23px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {/* Child Groups inside Condo Photos */}
                        {attachmentSteps.map((step, idx) => (
                          <div
                            key={step.id}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '10px',
                              padding: '10px 12px',
                              borderRadius: '6px',
                              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.025)' : 'rgba(0, 0, 0, 0.02)',
                              border: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(0, 0, 0, 0.06)',
                              transition: 'all 0.12s ease',
                            }}
                          >
                            {/* Child Title Header: Group N on left, Segmented Source Selector (+ Trash) on right */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span
                                style={{
                                  fontSize: '0.6875rem',
                                  fontWeight: 600,
                                  color: isDark ? '#F0F6FC' : '#0F172A',
                                }}
                              >
                                Group {idx + 1}
                              </span>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {/* Sleek Segmented Control */}
                                <div
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    backgroundColor: isDark ? 'rgba(0, 0, 0, 0.35)' : '#E2E8F0',
                                    borderRadius: '5px',
                                    padding: '2px',
                                    gap: '2px',
                                    border: isDark ? '1px solid rgba(255, 255, 255, 0.04)' : '1px solid rgba(0, 0, 0, 0.04)',
                                  }}
                                >
                                  {(['folder', 'upload', 'enhanced'] as const).map((st) => {
                                    const isSel = step.sourceType === st;
                                    return (
                                      <button
                                        key={st}
                                        type="button"
                                        onClick={() => handleUpdateStep(step.id, { sourceType: st })}
                                        style={{
                                          padding: '2px 8px',
                                          borderRadius: '3px',
                                          fontSize: '0.625rem',
                                          fontWeight: isSel ? 600 : 500,
                                          backgroundColor: isSel
                                            ? (isDark ? '#21262D' : '#FFFFFF')
                                            : 'transparent',
                                          color: isSel
                                            ? (isDark ? '#F0F6FC' : '#0F172A')
                                            : (isDark ? '#8B949E' : '#64748B'),
                                          border: 'none',
                                          boxShadow: isSel ? (isDark ? '0 1px 2px rgba(0,0,0,0.3)' : '0 1px 2px rgba(0,0,0,0.08)') : 'none',
                                          cursor: 'pointer',
                                          textTransform: 'capitalize',
                                          transition: 'all 0.12s ease',
                                        }}
                                      >
                                        {st}
                                      </button>
                                    );
                                  })}
                                </div>

                                {attachmentSteps.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveStep(step.id)}
                                    title={`Remove Group ${idx + 1}`}
                                    style={{
                                      width: '20px',
                                      height: '20px',
                                      borderRadius: '4px',
                                      backgroundColor: 'transparent',
                                      color: isDark ? '#8B949E' : '#94A3B8',
                                      border: 'none',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      padding: 0,
                                      transition: 'all 0.12s ease',
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.color = isDark ? '#F85149' : '#DC2626';
                                      e.currentTarget.style.backgroundColor = isDark ? 'rgba(248, 81, 73, 0.1)' : '#FEF2F2';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.color = isDark ? '#8B949E' : '#94A3B8';
                                      e.currentTarget.style.backgroundColor = 'transparent';
                                    }}
                                  >
                                    <FiTrash2 size={11} />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Group Content: Folder, Upload, or Enhanced */}
                            {step.sourceType === 'folder' && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveFolderDropdownStepId(activeFolderDropdownStepId === step.id ? null : step.id);
                                        setFolderSearchFilter('');
                                      }}
                                      style={{
                                        flex: 1,
                                        height: '28px',
                                        padding: '0 8px',
                                        borderRadius: '4px',
                                        border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                                        backgroundColor: isDark ? '#161B22' : '#FFFFFF',
                                        color: isDark ? '#F0F6FC' : '#0F172A',
                                        fontSize: '0.6875rem',
                                        fontWeight: 500,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                      }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                                        <FiFolder size={12} style={{ color: step.folderName ? '#58A6FF' : (isDark ? '#8B949E' : '#64748B'), flexShrink: 0 }} />
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: step.folderName ? (isDark ? '#F0F6FC' : '#0F172A') : (isDark ? '#8B949E' : '#64748B') }}>
                                          {step.folderName || 'Search condo folder (optional)...'}
                                        </span>
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        {step.folderName && (
                                          <span
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleUpdateStep(step.id, { folderName: '', folderImages: [] });
                                            }}
                                            title="Clear folder"
                                            style={{
                                              padding: '2px',
                                              display: 'flex',
                                              alignItems: 'center',
                                              color: isDark ? '#8B949E' : '#64748B',
                                            }}
                                          >
                                            <FiX size={11} />
                                          </span>
                                        )}
                                        <FiChevronDown size={12} style={{ color: isDark ? '#8B949E' : '#64748B', flexShrink: 0 }} />
                                      </div>
                                    </button>

                                    {step.folderName && (
                                      <button
                                        type="button"
                                        title="Refresh folders from disk"
                                        onClick={() => {
                                          loadCondoFolders();
                                          fetchImagesForStep(step.id, step.folderName);
                                        }}
                                        style={{
                                          width: '28px',
                                          height: '28px',
                                          borderRadius: '4px',
                                          border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                                          backgroundColor: isDark ? '#161B22' : '#FFFFFF',
                                          color: isDark ? '#8B949E' : '#64748B',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          cursor: 'pointer',
                                          flexShrink: 0,
                                          transition: 'all 0.12s ease',
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.color = isDark ? '#58A6FF' : '#2563EB';
                                          e.currentTarget.style.borderColor = isDark ? '#58A6FF' : '#2563EB';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.color = isDark ? '#8B949E' : '#64748B';
                                          e.currentTarget.style.borderColor = isDark ? '#30363D' : '#CBD5E1';
                                        }}
                                      >
                                        <FiRefreshCw size={11} />
                                      </button>
                                    )}
                                  </div>

                                  {/* Dropdown Menu */}
                                  {activeFolderDropdownStepId === step.id && (
                                    <>
                                      <div
                                        style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                                        onClick={() => setActiveFolderDropdownStepId(null)}
                                      />
                                      <div
                                        style={{
                                          position: 'absolute',
                                          top: '32px',
                                          left: 0,
                                          right: 0,
                                          zIndex: 50,
                                          borderRadius: '6px',
                                          border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                                          backgroundColor: isDark ? '#161B22' : '#FFFFFF',
                                          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                                          padding: '6px',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          gap: '6px',
                                        }}
                                      >
                                        <div
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '0 8px',
                                            height: '26px',
                                            borderRadius: '4px',
                                            border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                                            backgroundColor: isDark ? '#0D1117' : '#F8FAFC',
                                          }}
                                        >
                                          <FiSearch size={11} style={{ color: isDark ? '#8B949E' : '#64748B' }} />
                                          <input
                                            type="text"
                                            autoFocus
                                            value={folderSearchFilter}
                                            onChange={(e) => setFolderSearchFilter(e.target.value)}
                                            placeholder="Type condo name to search..."
                                            style={{
                                              flex: 1,
                                              border: 'none',
                                              background: 'transparent',
                                              outline: 'none',
                                              fontSize: '0.65625rem',
                                              color: isDark ? '#F0F6FC' : '#0F172A',
                                            }}
                                          />
                                        </div>

                                        <div
                                          style={{
                                            maxHeight: '160px',
                                            overflowY: 'auto',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '2px',
                                          }}
                                        >
                                          {!folderSearchFilter.trim() ? (
                                            <div style={{ padding: '8px', fontSize: '0.625rem', color: isDark ? '#8B949E' : '#64748B', textAlign: 'center' }}>
                                              Type condo name to search folders...
                                            </div>
                                          ) : filteredCondoFolders.length === 0 ? (
                                            <div style={{ padding: '8px', fontSize: '0.625rem', color: isDark ? '#8B949E' : '#64748B', textAlign: 'center' }}>
                                              No matching condo folder found
                                            </div>
                                          ) : (
                                            filteredCondoFolders.map((fName) => {
                                              const isSelected = step.folderName === fName;
                                              return (
                                                <button
                                                  key={fName}
                                                  type="button"
                                                  onClick={() => {
                                                    handleUpdateStep(step.id, { folderName: fName });
                                                    fetchImagesForStep(step.id, fName);
                                                    setActiveFolderDropdownStepId(null);
                                                    setFolderSearchFilter('');
                                                  }}
                                                  style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '5px 8px',
                                                    borderRadius: '4px',
                                                    border: 'none',
                                                    backgroundColor: isSelected
                                                      ? (isDark ? '#21262D' : '#E2E8F0')
                                                      : 'transparent',
                                                    color: isSelected ? '#58A6FF' : (isDark ? '#C9D1D9' : '#334155'),
                                                    fontSize: '0.65625rem',
                                                    fontWeight: isSelected ? 600 : 400,
                                                    cursor: 'pointer',
                                                    textAlign: 'left',
                                                  }}
                                                >
                                                  <FiFolder size={11} style={{ flexShrink: 0, color: isSelected ? '#58A6FF' : (isDark ? '#8B949E' : '#64748B') }} />
                                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {fName}
                                                  </span>
                                                </button>
                                              );
                                            })
                                          )}
                                        </div>
                                      </div>
                                    </>
                                  )}
                                </div>

                                {/* Photos Found & Thumbnails, or Manual Selection */}
                                {step.folderImages && step.folderImages.length > 0 ? (
                                  <div
                                    style={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '6px',
                                      marginTop: '2px',
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                      <span style={{ fontSize: '0.625rem', color: isDark ? '#8B949E' : '#64748B' }}>
                                        Found {step.folderImages.length} photo{step.folderImages.length > 1 ? 's' : ''} in {step.folderName}
                                      </span>
                                      {renderCountStepper(step)}
                                    </div>

                                    {/* Real photo thumbnails grid */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', padding: '2px 0' }}>
                                      {step.folderImages.map((img, tIdx) => {
                                        const isSelected = tIdx < step.count;
                                        return (
                                          <div
                                            key={img.filename || tIdx}
                                            onClick={() => {
                                              const otherGroupsCount = attachmentSteps
                                                .filter((other) => other.id !== step.id && other.enabled)
                                                .reduce((acc, other) => acc + other.count, 0);
                                              const maxAllowed = Math.max(1, 10 - otherGroupsCount);
                                              handleUpdateStep(step.id, { count: Math.min(maxAllowed, tIdx + 1) });
                                            }}
                                            title={`Click to select up to photo #${tIdx + 1} (${img.filename})`}
                                            style={{
                                              width: '42px',
                                              height: '42px',
                                              borderRadius: '4px',
                                              border: isSelected
                                                ? (isDark ? '1.5px solid #58A6FF' : '1.5px solid #2563EB')
                                                : (isDark ? '1px dashed #30363D' : '1px dashed #CBD5E1'),
                                              opacity: isSelected ? 1 : 0.4,
                                              overflow: 'hidden',
                                              position: 'relative',
                                              flexShrink: 0,
                                              cursor: 'pointer',
                                              backgroundColor: isDark ? '#161B22' : '#F1F5F9',
                                              transition: 'all 0.15s ease',
                                            }}
                                          >
                                            {img.data_url ? (
                                              <img
                                                src={img.data_url}
                                                alt={img.filename}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                              />
                                            ) : (
                                              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isDark ? '#8B949E' : '#64748B' }}>
                                                <FiImage size={13} />
                                              </div>
                                            )}
                                            <span
                                              style={{
                                                position: 'absolute',
                                                bottom: 1,
                                                right: 1,
                                                backgroundColor: isSelected ? 'rgba(37,99,235,0.85)' : 'rgba(0,0,0,0.65)',
                                                color: '#fff',
                                                fontSize: '7px',
                                                fontWeight: 600,
                                                padding: '1px 3px',
                                                borderRadius: '2px',
                                              }}
                                            >
                                              {isSelected ? `✓ #${tIdx + 1}` : `#${tIdx + 1}`}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ) : (
                                  /* Manual Mode when no condo folder selected yet */
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                                        <span style={{ fontSize: '0.625rem', color: isDark ? '#8B949E' : '#64748B', width: '38px', flexShrink: 0 }}>
                                          Image:
                                        </span>
                                        <input
                                          type="text"
                                          value={step.imageSelection || ''}
                                          onChange={(e) => handleUpdateStep(step.id, { imageSelection: e.target.value })}
                                          placeholder="Specific photo name (e.g. 1.png, 2.png) or choose manual..."
                                          style={{
                                            flex: 1,
                                            height: '26px',
                                            padding: '0 8px',
                                            borderRadius: '4px',
                                            border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                                            backgroundColor: isDark ? '#161B22' : '#FFFFFF',
                                            color: isDark ? '#F0F6FC' : '#0F172A',
                                            fontSize: '0.65625rem',
                                            outline: 'none',
                                          }}
                                        />
                                      </div>
                                      {renderCountStepper(step)}
                                    </div>

                                    {/* Manual selection from listing photos if available */}
                                    {propertyImages.length > 0 && (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <span style={{ fontSize: '0.59375rem', color: isDark ? '#8B949E' : '#64748B' }}>
                                          Select from listing photos ({propertyImages.length} available):
                                        </span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', overflowX: 'auto', padding: '2px 0' }}>
                                          {propertyImages.slice(0, 10).map((pImg, pIdx) => {
                                            const isSel = pIdx < step.count;
                                            return (
                                              <div
                                                key={pImg.url || pIdx}
                                                onClick={() => handleUpdateStep(step.id, { count: pIdx + 1, imageSelection: pImg.filename || `Photo #${pIdx + 1}` })}
                                                title={`Click to select up to photo #${pIdx + 1}`}
                                                style={{
                                                  width: '38px',
                                                  height: '38px',
                                                  borderRadius: '4px',
                                                  border: isSel
                                                    ? (isDark ? '1.5px solid #58A6FF' : '1.5px solid #2563EB')
                                                    : (isDark ? '1px dashed #30363D' : '1px dashed #CBD5E1'),
                                                  opacity: isSel ? 1 : 0.45,
                                                  overflow: 'hidden',
                                                  position: 'relative',
                                                  flexShrink: 0,
                                                  cursor: 'pointer',
                                                  backgroundColor: isDark ? '#161B22' : '#F1F5F9',
                                                }}
                                              >
                                                <img src={pImg.url} alt={`Listing ${pIdx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                <span
                                                  style={{
                                                    position: 'absolute',
                                                    bottom: 1,
                                                    right: 1,
                                                    backgroundColor: isSel ? 'rgba(37,99,235,0.85)' : 'rgba(0,0,0,0.65)',
                                                    color: '#fff',
                                                    fontSize: '7px',
                                                    fontWeight: 600,
                                                    padding: '1px 3px',
                                                    borderRadius: '2px',
                                                  }}
                                                >
                                                  {isSel ? `✓ #${pIdx + 1}` : `#${pIdx + 1}`}
                                                </span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            {step.sourceType === 'upload' && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                  <label
                                    style={{
                                      height: '28px',
                                      padding: '0 10px',
                                      borderRadius: '4px',
                                      fontSize: '0.65625rem',
                                      fontWeight: 500,
                                      backgroundColor: isDark ? '#161B22' : '#FFFFFF',
                                      color: isDark ? '#F0F6FC' : '#0F172A',
                                      border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      whiteSpace: 'nowrap',
                                      flexShrink: 0,
                                      transition: 'all 0.12s ease',
                                    }}
                                  >
                                    <FiUpload size={12} style={{ color: isDark ? '#58A6FF' : '#2563EB' }} />
                                    <span>{step.uploadedUrls?.length ? `${step.uploadedUrls.length}/${step.count} Selected` : 'Choose Files'}</span>
                                    <input
                                      type="file"
                                      multiple
                                      accept="image/*"
                                      onChange={(e) => {
                                        const files = Array.from(e.target.files || []);
                                        if (files.length === 0) return;
                                        const urls: string[] = [];
                                        let readCount = 0;
                                        files.slice(0, step.count).forEach((f) => {
                                          const reader = new FileReader();
                                          reader.onload = (ev) => {
                                            if (ev.target?.result) urls.push(ev.target.result as string);
                                            readCount++;
                                            if (readCount === Math.min(files.length, step.count)) {
                                              handleUpdateStep(step.id, { uploadedUrls: urls });
                                            }
                                          };
                                          reader.readAsDataURL(f);
                                        });
                                      }}
                                      style={{ display: 'none' }}
                                    />
                                  </label>

                                  <span
                                    style={{
                                      fontSize: '0.625rem',
                                      color: isDark ? '#8B949E' : '#64748B',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      flex: 1,
                                    }}
                                  >
                                    {step.uploadedUrls?.length ? `${step.uploadedUrls.length} file(s) ready` : `Max ${step.count} image(s)`}
                                  </span>

                                  {renderCountStepper(step)}
                                </div>

                                {/* Thumbnail previews for uploaded files */}
                                {step.uploadedUrls && step.uploadedUrls.length > 0 && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', padding: '2px 0' }}>
                                    {step.uploadedUrls.map((url, uIdx) => (
                                      <div
                                        key={uIdx}
                                        style={{
                                          width: '42px',
                                          height: '42px',
                                          borderRadius: '4px',
                                          border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                                          overflow: 'hidden',
                                          position: 'relative',
                                          flexShrink: 0,
                                          backgroundColor: isDark ? '#161B22' : '#F1F5F9',
                                        }}
                                      >
                                        <img src={url} alt={`Upload ${uIdx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        <span
                                          style={{
                                            position: 'absolute',
                                            bottom: 1,
                                            right: 1,
                                            backgroundColor: 'rgba(37,99,235,0.85)',
                                            color: '#fff',
                                            fontSize: '7px',
                                            fontWeight: 600,
                                            padding: '1px 3px',
                                            borderRadius: '2px',
                                          }}
                                        >
                                          #{uIdx + 1}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {step.sourceType === 'enhanced' && (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                <div style={{ fontSize: '0.625rem', color: isDark ? '#8B949E' : '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  Will pull {step.count} enhanced room photo(s) from Canvas AI processor.
                                </div>
                                {renderCountStepper(step)}
                              </div>
                            )}
                          </div>
                        ))}

                        {/* Add Group Button */}
                        <button
                          type="button"
                          disabled={totalCondoImagesCount >= 10}
                          onClick={handleAddStep}
                          style={{
                            height: '28px',
                            borderRadius: '4px',
                            fontSize: '0.65625rem',
                            fontWeight: 500,
                            backgroundColor: 'transparent',
                            border: isDark ? '1px dashed #30363D' : '1px dashed #CBD5E1',
                            color: totalCondoImagesCount >= 10 ? (isDark ? '#484F58' : '#94A3B8') : (isDark ? '#8B949E' : '#64748B'),
                            cursor: totalCondoImagesCount >= 10 ? 'not-allowed' : 'pointer',
                            opacity: totalCondoImagesCount >= 10 ? 0.45 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '5px',
                            transition: 'all 0.12s ease',
                          }}
                          onMouseEnter={(e) => {
                            if (totalCondoImagesCount < 10) {
                              e.currentTarget.style.borderColor = isDark ? '#58A6FF' : '#2563EB';
                              e.currentTarget.style.color = isDark ? '#58A6FF' : '#2563EB';
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = isDark ? '#30363D' : '#CBD5E1';
                            e.currentTarget.style.color = totalCondoImagesCount >= 10 ? (isDark ? '#484F58' : '#94A3B8') : (isDark ? '#8B949E' : '#64748B');
                          }}
                        >
                          <FiPlus size={11} />
                          <span>{totalCondoImagesCount >= 10 ? 'Max 10 Photos Limit Reached' : `Add Group (${attachmentSteps.length + 1})`}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Item 4: Connected Prompt */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FiFileText size={15} style={{ color: isDark ? '#8B949E' : '#64748B', flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: isDark ? '#F0F6FC' : '#0F172A' }}>
                            Connected Prompt
                          </div>
                          <div style={{ fontSize: '0.625rem', color: isDark ? '#8B949E' : '#64748B' }}>
                            AI prompt from canvas
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedPromptSource('upstream_ai')}
                          style={{
                            padding: '3px 10px',
                            borderRadius: '4px',
                            fontSize: '0.65625rem',
                            fontWeight: selectedPromptSource === 'upstream_ai' ? 600 : 400,
                            backgroundColor: selectedPromptSource === 'upstream_ai'
                              ? (isDark ? '#21262D' : '#E2E8F0')
                              : 'transparent',
                            color: selectedPromptSource === 'upstream_ai'
                              ? (isDark ? '#F0F6FC' : '#0F172A')
                              : (isDark ? '#8B949E' : '#64748B'),
                            border: selectedPromptSource === 'upstream_ai'
                              ? (isDark ? '1px solid #6E7681' : '1px solid #94A3B8')
                              : (isDark ? '1px solid #30363D' : '1px solid #CBD5E1'),
                            cursor: 'pointer',
                          }}
                        >
                          Canvas AI
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedPromptSource('custom')}
                          style={{
                            padding: '3px 10px',
                            borderRadius: '4px',
                            fontSize: '0.65625rem',
                            fontWeight: selectedPromptSource === 'custom' ? 600 : 400,
                            backgroundColor: selectedPromptSource === 'custom'
                              ? (isDark ? '#21262D' : '#E2E8F0')
                              : 'transparent',
                            color: selectedPromptSource === 'custom'
                              ? (isDark ? '#F0F6FC' : '#0F172A')
                              : (isDark ? '#8B949E' : '#64748B'),
                            border: selectedPromptSource === 'custom'
                              ? (isDark ? '1px solid #6E7681' : '1px solid #94A3B8')
                              : (isDark ? '1px solid #30363D' : '1px solid #CBD5E1'),
                            cursor: 'pointer',
                          }}
                        >
                          Custom
                        </button>
                      </div>
                    </div>

                    <div style={{ paddingLeft: '23px' }}>
                      {selectedPromptSource === 'upstream_ai' ? (
                        <Select
                          options={cleanPromptOptions}
                          value={selectedUpstreamAiId}
                          onChange={(val) => setSelectedUpstreamAiId(String(val))}
                          height="34px"
                        />
                      ) : (
                        <textarea
                          rows={2}
                          value={customPromptText}
                          onChange={(e) => setCustomPromptText(e.target.value)}
                          placeholder="Enter custom generation prompt..."
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            borderRadius: '6px',
                            border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                            backgroundColor: isDark ? '#161B22' : '#FFFFFF',
                            color: isDark ? '#F0F6FC' : '#0F172A',
                            fontSize: '0.6875rem',
                            boxSizing: 'border-box',
                            outline: 'none',
                          }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* ENHANCE MODE PIPELINE */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* Worker Tabs Count */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '1rem', borderBottom: isDark ? '1px solid #21262D' : '1px solid #F1F5F9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FiSliders size={15} style={{ color: isDark ? '#8B949E' : '#64748B', flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: isDark ? '#F0F6FC' : '#0F172A' }}>
                            Worker Tabs
                          </div>
                          <div style={{ fontSize: '0.625rem', color: isDark ? '#8B949E' : '#64748B' }}>
                            Parallel tabs for processing
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {[1, 2, 4, 6].map((count) => {
                          const isSel = workerTabsCount === count;
                          return (
                            <button
                              key={count}
                              type="button"
                              onClick={() => setWorkerTabsCount(count)}
                              style={{
                                padding: '4px 10px',
                                borderRadius: '4px',
                                fontSize: '0.65625rem',
                                fontWeight: isSel ? 600 : 400,
                                backgroundColor: isSel
                                  ? (isDark ? '#21262D' : '#E2E8F0')
                                  : 'transparent',
                                color: isSel
                                  ? (isDark ? '#F0F6FC' : '#0F172A')
                                  : (isDark ? '#8B949E' : '#64748B'),
                                border: isSel
                                  ? (isDark ? '1px solid #6E7681' : '1px solid #94A3B8')
                                  : (isDark ? '1px solid #30363D' : '1px solid #CBD5E1'),
                                cursor: 'pointer',
                              }}
                            >
                              {count} {count === 1 ? 'Tab' : 'Tabs'}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Enhancement Template */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '1rem', borderBottom: isDark ? '1px solid #21262D' : '1px solid #F1F5F9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FiFileText size={15} style={{ color: isDark ? '#8B949E' : '#64748B', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: isDark ? '#F0F6FC' : '#0F172A' }}>
                          Enhance Preset
                        </div>
                        <div style={{ fontSize: '0.625rem', color: isDark ? '#8B949E' : '#64748B' }}>
                          Prompt sent to each worker tab
                        </div>
                      </div>
                    </div>
                    <div style={{ paddingLeft: '23px' }}>
                      <Select
                        options={[
                          { label: 'Photo Retouch & Straightening', value: 'photo_retouch' },
                          { label: 'Clean & Bright Interior', value: 'clean_interior' },
                          { label: 'Architectural Exterior', value: 'architectural' },
                        ]}
                        value={enhancePromptPreset}
                        onChange={(val) => setEnhancePromptPreset(String(val))}
                        height="34px"
                      />
                    </div>
                  </div>

                  {/* Input Source */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FiFolder size={15} style={{ color: isDark ? '#8B949E' : '#64748B', flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: isDark ? '#F0F6FC' : '#0F172A' }}>
                            Input Photos
                          </div>
                          <div style={{ fontSize: '0.625rem', color: isDark ? '#8B949E' : '#64748B' }}>
                            Photos from Get Images
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => setEnhancePhotoSource('all')}
                          style={{
                            padding: '4px 12px',
                            borderRadius: '4px',
                            fontSize: '0.65625rem',
                            fontWeight: enhancePhotoSource === 'all' ? 600 : 400,
                            backgroundColor: enhancePhotoSource === 'all'
                              ? (isDark ? '#21262D' : '#E2E8F0')
                              : 'transparent',
                            color: enhancePhotoSource === 'all'
                              ? (isDark ? '#F0F6FC' : '#0F172A')
                              : (isDark ? '#8B949E' : '#64748B'),
                            border: enhancePhotoSource === 'all'
                              ? (isDark ? '1px solid #6E7681' : '1px solid #94A3B8')
                              : (isDark ? '1px solid #30363D' : '1px solid #CBD5E1'),
                            cursor: 'pointer',
                          }}
                        >
                          All ({propertyImages.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setEnhancePhotoSource('hero_only')}
                          style={{
                            padding: '4px 12px',
                            borderRadius: '4px',
                            fontSize: '0.65625rem',
                            fontWeight: enhancePhotoSource === 'hero_only' ? 600 : 400,
                            backgroundColor: enhancePhotoSource === 'hero_only'
                              ? (isDark ? '#21262D' : '#E2E8F0')
                              : 'transparent',
                            color: enhancePhotoSource === 'hero_only'
                              ? (isDark ? '#F0F6FC' : '#0F172A')
                              : (isDark ? '#8B949E' : '#64748B'),
                            border: enhancePhotoSource === 'hero_only'
                              ? (isDark ? '1px solid #6E7681' : '1px solid #94A3B8')
                              : (isDark ? '1px solid #30363D' : '1px solid #CBD5E1'),
                            cursor: 'pointer',
                          }}
                        >
                          Hero Only
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN: LIVE WORKFLOW PREVIEW ── */}
        <div
          style={{
            overflowY: 'auto',
            padding: '1.25rem',
            backgroundColor: isDark ? '#0D1117' : '#F8FAFC',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FiEye size={13} style={{ color: isDark ? '#8B949E' : '#64748B' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: isDark ? '#F0F6FC' : '#0F172A' }}>
                Workflow Preview
              </span>
            </div>
            <span
              style={{
                fontSize: '0.625rem',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: isDark ? 'rgba(35, 134, 54, 0.15)' : '#ECFDF5',
                color: isDark ? '#3FB950' : '#166534',
                border: isDark ? '1px solid rgba(35, 134, 54, 0.3)' : '1px solid #BBF7D0',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <FiCheck size={10} />
              <span>Ready</span>
            </span>
          </div>

          {/* 1. Canvas Node Flow Visualization */}
          <div
            style={{
              padding: '0.75rem 0.85rem',
              borderRadius: '6px',
              border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
              backgroundColor: isDark ? '#161B22' : '#FFFFFF',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ fontSize: '0.625rem', fontWeight: 600, color: isDark ? '#8B949E' : '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Canvas Node Hierarchy
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              {/* Chrome Profile Parent */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  backgroundColor: isDark ? '#21262D' : '#F1F5F9',
                  border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                  fontSize: '0.6875rem',
                  fontWeight: 500,
                  color: isDark ? '#F0F6FC' : '#0F172A',
                }}
              >
                <FiMonitor size={11} style={{ color: isDark ? '#8B949E' : '#64748B' }} />
                <span>{browserProfileName || fromTitle}</span>
              </div>

              <FiArrowRight size={11} style={{ color: isDark ? '#6E7681' : '#94A3B8' }} />

              {/* Flow Child Node */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  backgroundColor: isDark ? '#21262D' : '#F1F5F9',
                  border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  color: isDark ? '#F0F6FC' : '#0F172A',
                }}
              >
                <FiLayers size={11} style={{ color: isDark ? '#8B949E' : '#64748B' }} />
                <span>
                  {flowName || 'Tab Group'} ({tabGroupMode === 'generate' ? 1 : workerTabsCount} Tab{workerTabsCount > 1 && tabGroupMode === 'enhance' ? 's' : ''})
                </span>
              </div>

              {tabGroupMode === 'generate' && selectedPromptSource === 'upstream_ai' && selectedAiBox && (
                <>
                  <FiArrowRight size={11} style={{ color: isDark ? '#6E7681' : '#94A3B8' }} />
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      backgroundColor: isDark ? '#21262D' : '#F1F5F9',
                      border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                      fontSize: '0.6875rem',
                      fontWeight: 500,
                      color: isDark ? '#F0F6FC' : '#0F172A',
                      maxWidth: '180px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <FiFileText size={11} style={{ color: isDark ? '#8B949E' : '#64748B' }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {selectedAiBox.title.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{27BF}]/gu, '').trim()}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 2. Mock ChatGPT Composer Input Box Preview */}
          <div
            style={{
              padding: '0.75rem 0.85rem',
              borderRadius: '6px',
              border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
              backgroundColor: isDark ? '#161B22' : '#FFFFFF',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.625rem', fontWeight: 600, color: isDark ? '#8B949E' : '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Composer Simulation
              </span>
              <span style={{ fontSize: '0.625rem', color: isDark ? '#8B949E' : '#64748B' }}>
                {tabGroupMode === 'generate' ? `${totalCompositePhotos} Photo(s) Attached` : `${workerTabsCount} Concurrent Tabs`}
              </span>
            </div>

            {/* Input Composer Box */}
            <div
              style={{
                borderRadius: '6px',
                border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                backgroundColor: isDark ? '#0D1117' : '#F8FAFC',
                padding: '8px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {tabGroupMode === 'generate' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* Sequence Strip */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    {useReferenceImage && (
                      <div
                        style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: isDark ? '#21262D' : '#E2E8F0',
                          border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                          color: isDark ? '#C9D1D9' : '#334155',
                          fontSize: '0.59375rem',
                          fontWeight: 500,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <FiImage size={10} />
                        <span>Ref Layout (#1)</span>
                      </div>
                    )}

                    {useCondoImages && attachmentSteps.filter((s) => s.enabled).map((step, idx) => (
                      <div
                        key={step.id}
                        style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: isDark ? '#21262D' : '#E2E8F0',
                          border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                          color: isDark ? '#C9D1D9' : '#334155',
                          fontSize: '0.59375rem',
                          fontWeight: 500,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        {step.sourceType === 'folder' ? (
                          <FiFolder size={10} />
                        ) : step.sourceType === 'upload' ? (
                          <FiUpload size={10} />
                        ) : (
                          <FiLayers size={10} />
                        )}
                        <span>
                          Group {idx + 1} ({step.count} Photo{step.count > 1 ? 's' : ''})
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Thumbnail Strip */}
                  {(useReferenceImage || (useCondoImages && attachmentSteps.some((s) => s.enabled && s.count > 0))) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', overflowX: 'auto', padding: '2px 0' }}>
                      {useReferenceImage && (
                        <div
                          style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '4px',
                            border: isDark ? '1px solid #58A6FF' : '1px solid #2563EB',
                            overflow: 'hidden',
                            flexShrink: 0,
                            position: 'relative',
                            backgroundColor: '#1E293B',
                          }}
                        >
                          {referenceImageUrl ? (
                            <img src={referenceImageUrl} alt="Ref" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isDark ? '#8B949E' : '#64748B' }}>
                              <FiImage size={13} />
                            </div>
                          )}
                          <span style={{ position: 'absolute', bottom: 1, right: 1, backgroundColor: 'rgba(0,0,0,0.75)', color: '#fff', fontSize: '7px', padding: '1px 3px', borderRadius: '2px' }}>#1</span>
                        </div>
                      )}

                      {useCondoImages && attachmentSteps.filter((s) => s.enabled).map((step, sIdx) => {
                        return Array.from({ length: Math.min(10, Math.max(1, step.count)) }).map((_, i) => {
                          const img = step.uploadedUrls?.[i] || (step.sourceType === 'enhanced' ? enhancedImages[i]?.url : (step.folderImages?.[i]?.data_url || propertyImages[i]?.url));
                          const stepBadge = `G${sIdx + 1}-${i + 1}`;
                          return (
                            <div
                              key={`${step.id}-${i}`}
                              style={{
                                width: '38px',
                                height: '38px',
                                borderRadius: '4px',
                                border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                                overflow: 'hidden',
                                flexShrink: 0,
                                position: 'relative',
                                backgroundColor: '#1E293B',
                              }}
                            >
                              {img ? (
                                <img src={img} alt={`${step.title} ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isDark ? '#8B949E' : '#64748B' }}>
                                  {step.sourceType === 'folder' ? (
                                    <FiFolder size={12} />
                                  ) : step.sourceType === 'upload' ? (
                                    <FiUpload size={12} />
                                  ) : (
                                    <FiLayers size={12} />
                                  )}
                                </div>
                              )}
                              <span style={{ position: 'absolute', bottom: 1, right: 1, backgroundColor: 'rgba(0,0,0,0.75)', color: '#fff', fontSize: '7px', padding: '1px 3px', borderRadius: '2px' }}>{stepBadge}</span>
                            </div>
                          );
                        });
                      })}
                    </div>
                  )}

                  {/* Connected Prompt Reference */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 8px',
                      borderRadius: '4px',
                      backgroundColor: isDark ? '#161B22' : '#F1F5F9',
                      border: isDark ? '1px solid #21262D' : '1px solid #E2E8F0',
                      fontSize: '0.625rem',
                      color: isDark ? '#8B949E' : '#64748B',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
                      <FiFileText size={11} style={{ color: isDark ? '#8B949E' : '#64748B', flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        Prompt: <strong style={{ color: isDark ? '#F0F6FC' : '#0F172A' }}>{selectedPromptSource === 'custom' ? 'Custom Text' : (selectedAiBox?.title?.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{27BF}]/gu, '').trim() || 'AI Model')}</strong>
                      </span>
                    </div>
                    <span style={{ fontSize: '0.5625rem', color: isDark ? '#6E7681' : '#94A3B8', flexShrink: 0 }}>
                      {selectedPromptSource === 'custom' ? 'Custom' : 'Canvas AI'}
                    </span>
                  </div>

                  {/* Composer Bottom Bar */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px', borderTop: isDark ? '1px solid #21262D' : '1px solid #E2E8F0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.59375rem', color: isDark ? '#8B949E' : '#64748B' }}>
                      <FiCpu size={10} />
                      <span>ChatGPT 4o</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FiPaperclip size={12} style={{ color: isDark ? '#8B949E' : '#64748B' }} />
                      <div
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          backgroundColor: isDark ? '#21262D' : '#E2E8F0',
                          color: isDark ? '#F0F6FC' : '#0F172A',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <FiArrowUp size={10} />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Enhance Mode Preview */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: isDark ? '#F0F6FC' : '#0F172A', fontWeight: 600, fontSize: '0.6875rem' }}>
                    <FiSliders size={12} />
                    <span>Batch Workers ({workerTabsCount} Tabs)</span>
                  </div>
                  <div style={{ color: isDark ? '#8B949E' : '#64748B', fontSize: '0.625rem', lineHeight: 1.4 }}>
                    Each tab in profile "{browserProfileName || fromTitle}" receives 1 photo with "{enhancePromptPreset.replace(/_/g, ' ')}" template.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 3. Summary */}
          <div
            style={{
              padding: '0.75rem 0.85rem',
              borderRadius: '6px',
              border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
              backgroundColor: isDark ? '#161B22' : '#FFFFFF',
              fontSize: '0.6875rem',
              color: isDark ? '#8B949E' : '#64748B',
              display: 'flex',
              flexDirection: 'column',
              gap: '5px',
            }}
          >
            <div style={{ fontSize: '0.625rem', fontWeight: 600, color: isDark ? '#8B949E' : '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Execution Summary
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FiCheck size={11} style={{ color: isDark ? '#3FB950' : '#166534' }} />
              <span>Target Profile: <strong style={{ color: isDark ? '#F0F6FC' : '#0F172A' }}>{browserProfileName || fromTitle}</strong></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FiCheck size={11} style={{ color: isDark ? '#3FB950' : '#166534' }} />
              <span>
                {tabGroupMode === 'generate'
                  ? `Staging Mode: 1 Tab with ${totalCompositePhotos} Photos Attached`
                  : `Batch Mode: ${workerTabsCount} Concurrent Worker Tabs`}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FiCheck size={11} style={{ color: isDark ? '#3FB950' : '#166534' }} />
              <span>Condo Context: <strong style={{ color: isDark ? '#F0F6FC' : '#0F172A' }}>{condoName}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* ── FOOTER ACTION BAR (CLEAN APPLE / MAC MODAL BUTTON SIZE) ── */}
      <div
        style={{
          padding: '0.75rem 1.25rem',
          borderTop: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
          backgroundColor: isDark ? '#161B22' : '#F8FAFC',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.6875rem', color: isDark ? '#8B949E' : '#64748B' }}>
          <FiMonitor size={12} />
          <span>Profile: <strong style={{ color: isDark ? '#F0F6FC' : '#0F172A' }}>{browserProfileName || fromTitle}</strong></span>
          <span>•</span>
          <span>{tabGroupMode === 'generate' ? '1 Tab (Composite)' : `${workerTabsCount} Tabs (Batch)`}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              height: '32px',
              padding: '0 14px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 500,
              cursor: 'pointer',
              backgroundColor: 'transparent',
              border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
              color: isDark ? '#C9D1D9' : '#475569',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              outline: 'none',
              transition: 'all 0.12s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = isDark ? '#21262D' : '#F1F5F9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleCreateAndConnectFlow}
            style={{
              height: '32px',
              padding: '0 16px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: '#2563EB',
              border: '1px solid #1D4ED8',
              color: '#FFFFFF',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: 'none',
              outline: 'none',
              transition: 'background-color 0.12s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#1D4ED8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#2563EB';
            }}
          >
            <FiPlus size={13} />
            <span>Connect Flow</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
