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
  FiCheckSquare,
} from 'react-icons/fi';
import { Select } from '../../components/ui/Select';
import { ToggleSwitch } from '../../components/ui/ToggleSwitch';
import type { BrowserGroupItem } from './types';
import { AttachmentGroupsManager, type AttachmentStep } from './AttachmentGroupsManager';

export interface WorkflowImageSource {
  id: string;
  title: string;
  groupTitle?: string;
  nodeType?: string;
  images?: Array<{ url: string; index?: number; filename?: string }>;
  count?: number;
  description?: string;
}

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
  workflowImageNodes?: WorkflowImageSource[];
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
  workflowImageNodes = [],
  onConnectTabGroup,
}) => {
  // Navigation: 'custom_flow' vs 'discovered_groups'
  const [activeTab, setActiveTab] = useState<'custom_flow' | 'discovered_groups'>('custom_flow');

  // Resolved workflow image sources
  const activeWorkflowSources = useMemo<WorkflowImageSource[]>(() => {
    if (workflowImageNodes && workflowImageNodes.length > 0) {
      return workflowImageNodes;
    }
    const defs: WorkflowImageSource[] = [];
    if (propertyImages && propertyImages.length > 0) {
      defs.push({
        id: 'get-images',
        title: 'Get Images (All Media)',
        nodeType: 'get-images',
        images: propertyImages,
        count: propertyImages.length,
        description: `${propertyImages.length} listing photos`,
      });
    }
    defs.push({
      id: 'enhanced-images',
      title: 'Enhance IMG',
      groupTitle: 'External Browser #1',
      nodeType: 'enhance',
      images: enhancedImages,
      count: enhancedImages.length,
      description: `${enhancedImages.length} enhanced photos`,
    });
    defs.push({
      id: 'hero-images',
      title: 'FB Hero',
      groupTitle: 'External Browser #1',
      nodeType: 'hero',
      images: [],
      count: 0,
      description: '0 hero photos',
    });
    return defs;
  }, [workflowImageNodes, propertyImages, enhancedImages]);

  const workflowSourceOptions = useMemo(() => {
    return activeWorkflowSources.map((src) => ({
      value: src.id,
      label: `${src.title}${src.count !== undefined ? ` (${src.count} photo${src.count !== 1 ? 's' : ''})` : ''}`,
    }));
  }, [activeWorkflowSources]);

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
  const [activeWorkflowDropdownStepId, setActiveWorkflowDropdownStepId] = useState<string | null>(null);
  const [manualChooseModalStepId, setManualChooseModalStepId] = useState<string | null>(null);
  const [folderSearchFilter, setFolderSearchFilter] = useState<string>('');

  // Child Attachment Groups inside Condo Photos
  const [attachmentSteps, setAttachmentSteps] = useState<AttachmentStep[]>([
    {
      id: 'group-1',
      title: 'Group 1',
      count: 1,
      sourceType: 'upload',
      workflowSourceId: 'get-images',
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
        sourceType: 'upload',
        workflowSourceId: activeWorkflowSources[0]?.id || 'get-images',
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
      sourceType: 'folder' | 'upload' | 'workflow' | 'enhanced';
      workflowSourceId?: string;
      folderName: string;
      folderImages?: Array<{ filename: string; data_url?: string; full_path?: string; index?: number }>;
      imageSelection?: string;
      uploadedUrls?: string[];
      selectedIndices?: number[];
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
            onClick={() => {
              const newCount = Math.max(1, s.count - 1);
              const updates: any = { count: newCount };
              if (s.selectedIndices && s.selectedIndices.length > 0) {
                updates.selectedIndices = s.selectedIndices.slice(0, newCount);
              }
              handleUpdateStep(s.id, updates);
            }}
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
              const newCount = isNaN(val) ? 1 : Math.min(maxAllowed, Math.max(1, val));
              const updates: any = { count: newCount };
              if (s.selectedIndices && s.selectedIndices.length > 0) {
                updates.selectedIndices = s.selectedIndices.slice(0, newCount);
              }
              handleUpdateStep(s.id, updates);
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
            onClick={() => {
              if (s.count < maxAllowed) {
                const newCount = s.count + 1;
                const updates: any = { count: newCount };
                if (s.selectedIndices && s.selectedIndices.length > 0) {
                  const allIdxs = Array.from({ length: 25 }, (_, i) => i);
                  const nextUnselected = allIdxs.find((idx) => !s.selectedIndices!.includes(idx));
                  if (nextUnselected !== undefined) {
                    updates.selectedIndices = [...s.selectedIndices, nextUnselected];
                  }
                }
                handleUpdateStep(s.id, updates);
              }
            }}
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
    const primaryWorkflowStep = enabledSteps.find((s) => s.sourceType === 'workflow' || s.sourceType === 'enhanced');

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
      useEnhancedImages: tabGroupMode === 'generate' ? Boolean(primaryWorkflowStep) : false,
      enhancedImagesSource: primaryWorkflowStep?.workflowSourceId || 'workflow',
      enhancedImagesCount: tabGroupMode === 'generate' ? (primaryWorkflowStep ? primaryWorkflowStep.count : 0) : 0,
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
                <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: isDark ? '#8B949E' : '#64748B' }}>
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
                  <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: isDark ? '#8B949E' : '#64748B' }}>
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
                      <div style={{ padding: '4px 6px', fontSize: '0.625rem', fontWeight: 600, color: isDark ? '#8B949E' : '#64748B' }}>
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
                <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: isDark ? '#8B949E' : '#64748B' }}>
                  Action Mode
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px',
                    borderRadius: '9px',
                    backgroundColor: isDark ? 'rgba(0, 0, 0, 0.35)' : 'rgba(0, 0, 0, 0.05)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setTabGroupMode('generate')}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '6px 10px',
                      borderRadius: '7px',
                      fontSize: '0.6875rem',
                      fontWeight: tabGroupMode === 'generate' ? 700 : 500,
                      backgroundColor: tabGroupMode === 'generate'
                        ? (isDark ? 'rgba(59, 130, 246, 0.22)' : '#FFFFFF')
                        : 'transparent',
                      color: tabGroupMode === 'generate'
                        ? (isDark ? '#60A5FA' : '#2563EB')
                        : 'var(--text-muted)',
                      border: tabGroupMode === 'generate'
                        ? (isDark ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid rgba(0,0,0,0.08)')
                        : '1px solid transparent',
                      boxShadow: tabGroupMode === 'generate'
                        ? (isDark ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 2px rgba(0,0,0,0.06)')
                        : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <FiImage size={13} />
                    <span>Generate Image</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTabGroupMode('enhance')}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '6px 10px',
                      borderRadius: '7px',
                      fontSize: '0.6875rem',
                      fontWeight: tabGroupMode === 'enhance' ? 700 : 500,
                      backgroundColor: tabGroupMode === 'enhance'
                        ? (isDark ? 'rgba(16, 185, 129, 0.22)' : '#FFFFFF')
                        : 'transparent',
                      color: tabGroupMode === 'enhance'
                        ? (isDark ? '#34D399' : '#059669')
                        : 'var(--text-muted)',
                      border: tabGroupMode === 'enhance'
                        ? (isDark ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(0,0,0,0.08)')
                        : '1px solid transparent',
                      boxShadow: tabGroupMode === 'enhance'
                        ? (isDark ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 2px rgba(0,0,0,0.06)')
                        : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <FiSliders size={13} />
                    <span>Enhance Images</span>
                  </button>
                </div>
              </div>

              {/* 3. Pipeline Settings */}
              {tabGroupMode === 'generate' ? (
                /* GENERATE MODE PIPELINE */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {/* Section: Prompt */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'none', letterSpacing: '0.02em', marginTop: '2px' }}>
                      Prompt
                    </div>

                    {/* Connected Prompt Card */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.625rem',
                        padding: '0.875rem 1rem',
                        borderRadius: '12px',
                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#FFFFFF',
                        border: '1px solid var(--border-color)',
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
                            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                              Connected Prompt
                            </div>
                            <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                              AI prompt from canvas
                            </div>
                          </div>
                        </div>

                        {/* Mode pills */}
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            backgroundColor: isDark ? '#0D1117' : '#F1F5F9',
                            padding: '2px',
                            borderRadius: '6px',
                            border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedPromptSource('upstream_ai')}
                            style={{
                              padding: '3px 10px',
                              borderRadius: '4px',
                              border: 'none',
                              fontSize: '0.65625rem',
                              fontWeight: 600,
                              textTransform: 'none',
                              backgroundColor: selectedPromptSource === 'upstream_ai' ? (isDark ? '#21262D' : '#FFFFFF') : 'transparent',
                              color: selectedPromptSource === 'upstream_ai' ? (isDark ? '#F0F6FC' : '#0F172A') : (isDark ? '#8B949E' : '#64748B'),
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
                              border: 'none',
                              fontSize: '0.65625rem',
                              fontWeight: 600,
                              textTransform: 'none',
                              backgroundColor: selectedPromptSource === 'custom' ? (isDark ? '#21262D' : '#FFFFFF') : 'transparent',
                              color: selectedPromptSource === 'custom' ? (isDark ? '#F0F6FC' : '#0F172A') : (isDark ? '#8B949E' : '#64748B'),
                              cursor: 'pointer',
                            }}
                          >
                            Custom
                          </button>
                        </div>
                      </div>

                      {/* Prompt Input */}
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

                  {/* Section: Attached Images */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'none', letterSpacing: '0.02em', marginTop: '2px' }}>
                        Attached Images
                      </div>
                      <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                        {totalCompositePhotos} total photo{totalCompositePhotos !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Reference Layout Card */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.625rem',
                        padding: '0.875rem 1rem',
                        borderRadius: '12px',
                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#FFFFFF',
                        border: '1px solid var(--border-color)',
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
                            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                              Reference Layout
                            </div>
                            <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <input
                            type="file"
                            ref={refFileInputRef}
                            accept="image/*"
                            onChange={handleReferenceImageUpload}
                            style={{ display: 'none' }}
                          />

                          {referenceImageUrl ? (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '6px 10px',
                                borderRadius: '8px',
                                backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#F8FAFC',
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
                                    borderRadius: '6px',
                                    objectFit: 'cover',
                                    border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                                    flexShrink: 0,
                                  }}
                                />
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981', flexShrink: 0 }} />
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      Photo Attached
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                                    {referenceImageName || 'Reference Photo'}
                                  </div>
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                                <button
                                  type="button"
                                  onClick={() => refFileInputRef.current?.click()}
                                  style={{
                                    padding: '4px 8px',
                                    borderRadius: '5px',
                                    fontSize: '0.6875rem',
                                    fontWeight: 500,
                                    backgroundColor: isDark ? '#21262D' : '#F1F5F9',
                                    color: isDark ? '#E6EDF3' : '#334155',
                                    border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                                    cursor: 'pointer',
                                  }}
                                >
                                  Change
                                </button>
                                <button
                                  type="button"
                                  onClick={handleRemoveReferenceImage}
                                  style={{
                                    padding: '4px 8px',
                                    borderRadius: '5px',
                                    fontSize: '0.6875rem',
                                    fontWeight: 500,
                                    backgroundColor: isDark ? 'rgba(248, 81, 73, 0.1)' : '#FEF2F2',
                                    color: isDark ? '#F85149' : '#DC2626',
                                    border: isDark ? '1px solid rgba(248, 81, 73, 0.25)' : '1px solid #FECACA',
                                    cursor: 'pointer',
                                  }}
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ) : (
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
                                  borderRadius: '6px',
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
                                style={{
                                  height: '32px',
                                  padding: '0 10px',
                                  borderRadius: '6px',
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
                                style={{
                                  height: '32px',
                                  padding: '0 10px',
                                  borderRadius: '6px',
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
                                borderRadius: '8px',
                                border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                                backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#F8FAFC',
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
                                    background: 'transparent',
                                    color: isDark ? '#8B949E' : '#64748B',
                                    cursor: 'pointer',
                                    padding: '2px',
                                    display: 'flex',
                                    alignItems: 'center',
                                  }}
                                >
                                  <FiX size={12} />
                                </button>
                              </div>

                              {propertyImages && propertyImages.length > 0 ? (
                                <div
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(5, 1fr)',
                                    gap: '6px',
                                    maxHeight: '160px',
                                    overflowY: 'auto',
                                    padding: '4px',
                                  }}
                                >
                                  {propertyImages.map((img, i) => {
                                    const isSelected = referenceImageUrl === img.url;
                                    return (
                                      <button
                                        key={i}
                                        type="button"
                                        onClick={() => {
                                          setReferenceImageUrl(img.url);
                                          setReferenceImageName(img.filename || ("Photo #" + (img.index || i + 1)));
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
                                        <img src={img.url} alt={"Option " + (i + 1)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                                          #{(img.index || i + 1)}
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

                    {/* Condo Photos Multi-Group Manager */}
                    <AttachmentGroupsManager
                      steps={attachmentSteps}
                      onChange={setAttachmentSteps}
                      isDark={isDark}
                      useCondoImages={useCondoImages}
                      onToggleUseCondoImages={setUseCondoImages}
                      workflowImageSources={activeWorkflowSources}
                      propertyImages={propertyImages}
                      enhancedImages={enhancedImages}
                      condoName={condoName}
                    />
                  </div>
                </div>
              ) : (
                /* ENHANCE MODE PIPELINE */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {/* Worker Tabs Card */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.625rem',
                      padding: '0.875rem 1rem',
                      borderRadius: '12px',
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#FFFFFF',
                      border: '1px solid var(--border-color)',
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
                          <FiSliders size={14} />
                        </div>
                        <div>
                          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            Worker Tabs
                          </div>
                          <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
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

                  {/* Enhancement Template Card */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.625rem',
                      padding: '0.875rem 1rem',
                      borderRadius: '12px',
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#FFFFFF',
                      border: '1px solid var(--border-color)',
                      boxShadow: isDark ? '0 1px 3px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.05)',
                    }}
                  >
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
                        <FiFileText size={14} />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          Enhance Preset
                        </div>
                        <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                          Prompt sent to each worker tab
                        </div>
                      </div>
                    </div>
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

                  {/* Input Source Card */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.625rem',
                      padding: '0.875rem 1rem',
                      borderRadius: '12px',
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#FFFFFF',
                      border: '1px solid var(--border-color)',
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
                            backgroundColor: 'rgba(249, 115, 22, 0.12)',
                            color: '#F97316',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <FiFolder size={14} />
                        </div>
                        <div>
                          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            Input Photos
                          </div>
                          <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
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
            <div style={{ fontSize: '0.625rem', fontWeight: 600, color: isDark ? '#8B949E' : '#64748B' }}>
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
              <span style={{ fontSize: '0.625rem', fontWeight: 600, color: isDark ? '#8B949E' : '#64748B' }}>
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
                        const selectedSrc = activeWorkflowSources.find((w) => w.id === step.workflowSourceId) || activeWorkflowSources[0];
                        const sourceImages = selectedSrc?.images && selectedSrc.images.length > 0
                          ? selectedSrc.images
                          : (selectedSrc?.nodeType === 'enhance' ? enhancedImages : (selectedSrc?.nodeType === 'hero' ? (selectedSrc?.images || []) : propertyImages));

                        const chosenImages = (step.selectedIndices && step.selectedIndices.length > 0)
                          ? step.selectedIndices.map((idx) => sourceImages[idx]).filter(Boolean)
                          : sourceImages.slice(0, step.count);

                        return Array.from({ length: Math.min(10, Math.max(1, step.count)) }).map((_, i) => {
                          const img = step.uploadedUrls?.[i] ||
                            ((step.sourceType === 'workflow' || step.sourceType === 'enhanced')
                              ? chosenImages?.[i]?.url
                              : (step.folderImages?.[i]?.data_url || propertyImages[i]?.url));
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
            <div style={{ fontSize: '0.625rem', fontWeight: 600, color: isDark ? '#8B949E' : '#64748B' }}>
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
