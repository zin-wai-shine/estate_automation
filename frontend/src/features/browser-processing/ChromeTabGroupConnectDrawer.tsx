import React, { useState, useMemo, useRef } from 'react';
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
  condoName = 'Regent Home Bangna',
  propertyImages = [],
  enhancedImages = [],
  onConnectTabGroup,
}) => {
  // Navigation: 'custom_flow' vs 'discovered_groups'
  const [activeTab, setActiveTab] = useState<'custom_flow' | 'discovered_groups'>('custom_flow');

  // Custom Flow Configuration State
  const [flowName, setFlowName] = useState<string>('FB Hero');
  const [tabGroupMode, setTabGroupMode] = useState<'generate' | 'enhance'>('generate');

  // Generate Mode Settings
  const [useReferenceImage, setUseReferenceImage] = useState<boolean>(true);
  const [referenceImageUrl, setReferenceImageUrl] = useState<string>('');
  const [referenceImageName, setReferenceImageName] = useState<string>('');
  const [referenceFolderName, setReferenceFolderName] = useState<string>('Reference Layout');
  const [showFolderImagePicker, setShowFolderImagePicker] = useState<boolean>(false);
  const refFileInputRef = useRef<HTMLInputElement | null>(null);

  // Dynamic Image Attachment Steps (Customizable sequence after Reference Image)
  const [attachmentSteps, setAttachmentSteps] = useState<Array<{
    id: string;
    title: string;
    count: number;
    sourceType: 'folder' | 'upload' | 'enhanced';
    folderName: string;
    imageSelection?: string;
    uploadedUrls?: string[];
    enabled: boolean;
  }>>([
    {
      id: 'step-condo',
      title: 'Condo Photos',
      count: 1,
      sourceType: 'folder',
      folderName: condoName || 'Regent Home Bangna',
      imageSelection: '',
      enabled: true,
    },
    {
      id: 'step-interior',
      title: 'Interior Photos',
      count: 4,
      sourceType: 'enhanced',
      folderName: 'Interior',
      imageSelection: '',
      enabled: true,
    },
  ]);

  const handleAddStep = () => {
    const nextIdx = attachmentSteps.length + 1;
    setAttachmentSteps((prev) => [
      ...prev,
      {
        id: `step-${Date.now()}`,
        title: `Image Source #${nextIdx}`,
        count: 1,
        sourceType: 'folder',
        folderName: condoName || 'Condo Building',
        imageSelection: '',
        enabled: true,
      },
    ]);
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
      imageSelection?: string;
      uploadedUrls?: string[];
      enabled: boolean;
    }>
  ) => {
    setAttachmentSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
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
    return attachmentSteps
      .filter((s) => s.enabled)
      .reduce((sum, s) => sum + Math.min(10, Math.max(1, s.count)), 0);
  }, [attachmentSteps]);
  const totalCompositePhotos = effectiveRefPhotosCount + totalStepPhotos;

  // Handle Create Flow Click
  const handleCreateAndConnectFlow = () => {
    const finalName = flowName.trim() || (tabGroupMode === 'generate' ? 'FB Hero' : 'Enhance IMG');
    const enabledSteps = attachmentSteps.filter((s) => s.enabled);
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
      imageAttachmentSteps: tabGroupMode === 'generate' ? enabledSteps : [],
      totalAttachmentPhotos: tabGroupMode === 'generate' ? totalCompositePhotos : 0,
      // Backwards-compatible fields:
      useCondoImages: tabGroupMode === 'generate' ? Boolean(primaryFolderStep) : false,
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
              {/* 1. Flow Name & Quick Presets */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: isDark ? '#8B949E' : '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Flow Name
                </label>
                <input
                  type="text"
                  value={flowName}
                  onChange={(e) => setFlowName(e.target.value)}
                  placeholder="e.g. FB Hero, Enhance IMG, Tiktok Hero"
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

                {/* Presets */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                  <span style={{ fontSize: '0.625rem', color: isDark ? '#8B949E' : '#64748B' }}>Presets:</span>
                  {[
                    { label: 'FB Hero', mode: 'generate' as const },
                    { label: 'Enhance IMG', mode: 'enhance' as const },
                    { label: 'Tiktok Hero', mode: 'generate' as const },
                    { label: 'Marketplace', mode: 'generate' as const },
                    { label: 'Facilities', mode: 'generate' as const },
                  ].map((p) => {
                    const isActive = flowName === p.label;
                    return (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => {
                          setFlowName(p.label);
                          setTabGroupMode(p.mode);
                        }}
                        style={{
                          padding: '3px 9px',
                          borderRadius: '4px',
                          fontSize: '0.625rem',
                          fontWeight: isActive ? 600 : 400,
                          backgroundColor: isActive
                            ? (isDark ? '#21262D' : '#E2E8F0')
                            : (isDark ? 'rgba(255, 255, 255, 0.03)' : '#F8FAFC'),
                          color: isActive
                            ? (isDark ? '#F0F6FC' : '#0F172A')
                            : (isDark ? '#8B949E' : '#64748B'),
                          border: isActive
                            ? (isDark ? '1px solid #6E7681' : '1px solid #94A3B8')
                            : (isDark ? '1px solid #30363D' : '1px solid #E2E8F0'),
                          cursor: 'pointer',
                          transition: 'all 0.12s ease',
                        }}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
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

                  {/* Dynamic Image Attachment Steps (Customizable sequence after Reference Layout) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {attachmentSteps.map((step, idx) => (
                      <div
                        key={step.id}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                          paddingBottom: '1rem',
                          borderBottom: isDark ? '1px solid #21262D' : '1px solid #F1F5F9',
                        }}
                      >
                        {/* Header: Icon + Step Badge + Title + Switch + Delete */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                            <div style={{ color: isDark ? '#8B949E' : '#64748B', flexShrink: 0 }}>
                              {step.sourceType === 'folder' ? (
                                <FiFolder size={15} />
                              ) : step.sourceType === 'upload' ? (
                                <FiUpload size={15} />
                              ) : (
                                <FiLayers size={15} />
                              )}
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span
                                  style={{
                                    fontSize: '0.625rem',
                                    fontWeight: 600,
                                    color: isDark ? '#58A6FF' : '#2563EB',
                                    backgroundColor: isDark ? 'rgba(88, 166, 255, 0.1)' : '#EFF6FF',
                                    padding: '1px 5px',
                                    borderRadius: '3px',
                                  }}
                                >
                                  #{idx + 2} in Chat
                                </span>
                                <input
                                  type="text"
                                  value={step.title}
                                  onChange={(e) => handleUpdateStep(step.id, { title: e.target.value })}
                                  style={{
                                    fontSize: '0.8125rem',
                                    fontWeight: 600,
                                    color: isDark ? '#F0F6FC' : '#0F172A',
                                    background: 'transparent',
                                    border: 'none',
                                    outline: 'none',
                                    padding: 0,
                                    minWidth: '120px',
                                  }}
                                />
                              </div>
                              <div style={{ fontSize: '0.625rem', color: isDark ? '#8B949E' : '#64748B' }}>
                                {step.sourceType === 'folder'
                                  ? `From folder: ${step.folderName || 'Selected folder'}`
                                  : step.sourceType === 'upload'
                                  ? 'Manual user uploaded images'
                                  : 'Canvas AI enhanced images'}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                            {attachmentSteps.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveStep(step.id)}
                                title="Delete this image source"
                                style={{
                                  width: '24px',
                                  height: '24px',
                                  borderRadius: '4px',
                                  backgroundColor: isDark ? 'rgba(248, 81, 73, 0.08)' : '#FEF2F2',
                                  color: isDark ? '#F85149' : '#DC2626',
                                  border: isDark ? '1px solid rgba(248, 81, 73, 0.25)' : '1px solid #FECACA',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: 0,
                                }}
                              >
                                <FiTrash2 size={11} />
                              </button>
                            )}
                            <ToggleSwitch
                              checked={step.enabled}
                              onChange={(val) => handleUpdateStep(step.id, { enabled: val })}
                              size="sm"
                              activeColor="#2563EB"
                            />
                          </div>
                        </div>

                        {step.enabled && (
                          <div style={{ paddingLeft: '23px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {/* Row 1: Count */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'nowrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                <span style={{ fontSize: '0.6875rem', color: isDark ? '#8B949E' : '#64748B' }}>Count:</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={10}
                                  value={step.count}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    handleUpdateStep(step.id, { count: isNaN(val) ? 1 : Math.min(10, Math.max(1, val)) });
                                  }}
                                  style={{
                                    width: '38px',
                                    height: '28px',
                                    textAlign: 'center',
                                    borderRadius: '4px',
                                    border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                                    backgroundColor: isDark ? '#161B22' : '#FFFFFF',
                                    color: isDark ? '#F0F6FC' : '#0F172A',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    outline: 'none',
                                  }}
                                />
                                <span style={{ fontSize: '0.625rem', color: isDark ? '#8B949E' : '#64748B' }}>Photos (Max 10)</span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                {[1, 2, 3, 4, 5, 10].map((c) => {
                                  const isSel = step.count === c;
                                  return (
                                    <button
                                      key={c}
                                      type="button"
                                      onClick={() => handleUpdateStep(step.id, { count: c })}
                                      style={{
                                        padding: '3px 7px',
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
                                        transition: 'all 0.12s ease',
                                      }}
                                    >
                                      {c}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Row 2: Source Type */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                              <span style={{ fontSize: '0.6875rem', color: isDark ? '#8B949E' : '#64748B' }}>Source:</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {(['folder', 'upload', 'enhanced'] as const).map((st) => {
                                  const isSel = step.sourceType === st;
                                  return (
                                    <button
                                      key={st}
                                      type="button"
                                      onClick={() => handleUpdateStep(step.id, { sourceType: st })}
                                      style={{
                                        padding: '3px 10px',
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
                                        textTransform: 'capitalize',
                                      }}
                                    >
                                      {st}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Row 3: Source Configuration */}
                            {step.sourceType === 'folder' && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontSize: '0.625rem', color: isDark ? '#8B949E' : '#64748B', width: '38px', flexShrink: 0 }}>Folder:</span>
                                  <input
                                    type="text"
                                    value={step.folderName}
                                    onChange={(e) => handleUpdateStep(step.id, { folderName: e.target.value })}
                                    placeholder="Folder name (e.g. Regent Home Bangna, Living Room)..."
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
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontSize: '0.625rem', color: isDark ? '#8B949E' : '#64748B', width: '38px', flexShrink: 0 }}>Image:</span>
                                  <input
                                    type="text"
                                    value={step.imageSelection || ''}
                                    onChange={(e) => handleUpdateStep(step.id, { imageSelection: e.target.value })}
                                    placeholder="Specific photo name or leave blank for first N..."
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
                              </div>
                            )}

                            {step.sourceType === 'upload' && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <label
                                  style={{
                                    height: '28px',
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
                                  }}
                                >
                                  <FiUpload size={12} />
                                  <span>Choose Files ({step.uploadedUrls?.length || 0}/{step.count})</span>
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
                                <span style={{ fontSize: '0.625rem', color: isDark ? '#8B949E' : '#64748B' }}>
                                  {step.uploadedUrls?.length ? `${step.uploadedUrls.length} file(s) ready` : `Select up to ${step.count} image(s)`}
                                </span>
                              </div>
                            )}

                            {step.sourceType === 'enhanced' && (
                              <div style={{ fontSize: '0.625rem', color: isDark ? '#8B949E' : '#64748B' }}>
                                Will pull {step.count} enhanced room photo(s) from Canvas AI processor.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Add Image Source Button */}
                    <button
                      type="button"
                      onClick={handleAddStep}
                      style={{
                        height: '32px',
                        borderRadius: '5px',
                        fontSize: '0.6875rem',
                        fontWeight: 500,
                        backgroundColor: 'transparent',
                        border: isDark ? '1px dashed #30363D' : '1px dashed #CBD5E1',
                        color: isDark ? '#8B949E' : '#64748B',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'all 0.12s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = isDark ? '#58A6FF' : '#2563EB';
                        e.currentTarget.style.color = isDark ? '#58A6FF' : '#2563EB';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = isDark ? '#30363D' : '#CBD5E1';
                        e.currentTarget.style.color = isDark ? '#8B949E' : '#64748B';
                      }}
                    >
                      <FiPlus size={12} />
                      <span>Add Image Source</span>
                    </button>
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

                    {attachmentSteps.filter((s) => s.enabled).map((step, idx) => (
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
                          #{idx + 2}: {step.title} ({step.count} Photo{step.count > 1 ? 's' : ''})
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Thumbnail Strip */}
                  {(useReferenceImage || attachmentSteps.some((s) => s.enabled && s.count > 0)) && (
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

                      {attachmentSteps.filter((s) => s.enabled).map((step, sIdx) => {
                        return Array.from({ length: Math.min(10, Math.max(1, step.count)) }).map((_, i) => {
                          const img = step.uploadedUrls?.[i] || (step.sourceType === 'enhanced' ? enhancedImages[i]?.url : propertyImages[i]?.url);
                          const stepBadge = `S${sIdx + 1}-${i + 1}`;
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
