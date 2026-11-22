import React, { useState, useMemo } from 'react';
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
  FiCheckCircle,
  FiMonitor,
  FiEye,
  FiGitBranch,
  FiPaperclip,
  FiArrowUp,
  FiCpu,
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
  const [useCondoImages, setUseCondoImages] = useState<boolean>(true);
  const [condoImagesCount, setCondoImagesCount] = useState<number>(3);
  const [useEnhancedImages, setUseEnhancedImages] = useState<boolean>(true);
  const [enhancedImagesSource, setEnhancedImagesSource] = useState<'enhanced' | 'get_images'>('enhanced');
  const [enhancedImagesCount, setEnhancedImagesCount] = useState<number>(5);

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
  const effectiveCondoPhotosCount = useCondoImages ? condoImagesCount : 0;
  const effectiveEnhancedPhotosCount = useEnhancedImages ? enhancedImagesCount : 0;
  const totalCompositePhotos = effectiveRefPhotosCount + effectiveCondoPhotosCount + effectiveEnhancedPhotosCount;

  // Handle Create Flow Click
  const handleCreateAndConnectFlow = () => {
    const finalName = flowName.trim() || (tabGroupMode === 'generate' ? 'FB Hero' : 'Enhance IMG');
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
      useCondoImages: tabGroupMode === 'generate' ? useCondoImages : false,
      condoImagesCount: tabGroupMode === 'generate' ? condoImagesCount : 0,
      useEnhancedImages: tabGroupMode === 'generate' ? useEnhancedImages : false,
      enhancedImagesSource: tabGroupMode === 'generate' ? enhancedImagesSource : 'enhanced',
      enhancedImagesCount: tabGroupMode === 'generate' ? enhancedImagesCount : 5,
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
        backgroundColor: isDark ? 'var(--bg-main, #0D1117)' : '#FFFFFF',
        borderLeft: '1px solid var(--border-color, #30363D)',
        boxShadow: isDark
          ? '-12px 0 36px rgba(0, 0, 0, 0.8)'
          : '-4px 0 24px rgba(0, 0, 0, 0.08)',
        zIndex: 170,
        display: 'flex',
        flexDirection: 'column',
        animation: 'sidebarSlideIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* ── HEADER (CLEAN APPLE / VERCEL STYLE) ── */}
      <div
        style={{
          padding: '0.75rem 1.25rem',
          borderBottom: '1px solid var(--border-color, #30363D)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: isDark ? 'var(--bg-main, #0D1117)' : '#FFFFFF',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              backgroundColor: isDark ? 'rgba(59, 130, 246, 0.12)' : '#EFF6FF',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              color: 'var(--accent-primary, #3B82F6)',
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
                color: 'var(--text-primary)',
                letterSpacing: '-0.01em',
              }}
            >
              Connect Tab Group
            </h3>
            <p style={{ margin: '1px 0 0', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
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
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F1F5F9',
              borderRadius: '6px',
              padding: '2px',
              border: '1px solid var(--border-color)',
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
                color: activeTab === 'custom_flow' ? 'var(--text-primary)' : 'var(--text-muted)',
                border: activeTab === 'custom_flow' ? '1px solid var(--border-color)' : '1px solid transparent',
                boxShadow: activeTab === 'custom_flow' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.15s ease',
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
                color: activeTab === 'discovered_groups' ? 'var(--text-primary)' : 'var(--text-muted)',
                border: activeTab === 'discovered_groups' ? '1px solid var(--border-color)' : '1px solid transparent',
                boxShadow: activeTab === 'discovered_groups' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.15s ease',
              }}
            >
              <FiLayers size={11} />
              <span>Discovered ({discoveredTabGroups.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            title="Close"
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
          >
            <FiX size={14} />
          </button>
        </div>
      </div>

      {/* ── TWO-COLUMN BODY (LEFT: FEATURES/ITEMS, RIGHT: PREVIEW) ── */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '52% 48%',
          overflow: 'hidden',
        }}
      >
        {/* ── LEFT COLUMN: FEATURES AND ITEMS FOR USER ── */}
        <div
          style={{
            overflowY: 'auto',
            padding: '1.25rem',
            borderRight: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          {activeTab === 'discovered_groups' ? (
            /* ═══════════════════════════════════════════════════════════════════ */
            /* VIEW 1: DISCOVERED TAB GROUPS LIST                                 */
            /* ═══════════════════════════════════════════════════════════════════ */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Discovered in {browserProfileName || fromTitle}
                </span>
                <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
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
                    border: '1px solid var(--border-color)',
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : '#F8FAFC',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '5px',
                        backgroundColor: isDark ? 'rgba(59, 130, 246, 0.12)' : '#EFF6FF',
                        color: 'var(--accent-primary, #3B82F6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <FiLayers size={14} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.78125rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {g.name}
                        </span>
                        <span style={{ fontSize: '0.5625rem', padding: '1px 5px', borderRadius: '3px', backgroundColor: isDark ? '#30363D' : '#E2E8F0', color: 'var(--text-muted)', fontWeight: 600 }}>
                          {g.tabs?.length || g.tabs_count || 0} tabs
                        </span>
                      </div>
                      <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border-color)',
                        cursor: 'pointer',
                      }}
                    >
                      Customize
                    </button>
                    <button
                      type="button"
                      onClick={() => onConnectTabGroup(g)}
                      style={{
                        padding: '4px 9px',
                        borderRadius: '4px',
                        fontSize: '0.625rem',
                        fontWeight: 600,
                        backgroundColor: 'var(--accent-primary, #2563EB)',
                        color: '#FFFFFF',
                        border: 'none',
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
                    border: '1px dashed var(--border-color)',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  No tab groups found in this Chrome profile. You can create a new flow using the Create Flow tab.
                </div>
              )}
            </div>
          ) : (
            /* ═══════════════════════════════════════════════════════════════════ */
            /* VIEW 2: CUSTOM FLOW BUILDER                                        */
            /* ═══════════════════════════════════════════════════════════════════ */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* 1. Flow Name & Quick Presets */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Flow / Tab Group Name
                </label>
                <input
                  type="text"
                  value={flowName}
                  onChange={(e) => setFlowName(e.target.value)}
                  placeholder="e.g. FB Hero, Enhance IMG, Tiktok - BH Hero"
                  style={{
                    width: '100%',
                    height: '36px',
                    padding: '0 10px',
                    borderRadius: '6px',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    border: '1px solid var(--border-color)',
                    backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#FFFFFF',
                    color: 'var(--text-primary)',
                    boxSizing: 'border-box',
                  }}
                />

                {/* Quick Presets Pills */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap', marginTop: '3px' }}>
                  <span style={{ fontSize: '0.59375rem', color: 'var(--text-muted)' }}>Templates:</span>
                  {flowNamePresets.map((p) => {
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
                          padding: '2px 7px',
                          borderRadius: '4px',
                          fontSize: '0.59375rem',
                          fontWeight: isActive ? 600 : 500,
                          backgroundColor: isActive
                            ? (isDark ? 'rgba(59, 130, 246, 0.12)' : '#EFF6FF')
                            : (isDark ? 'rgba(255,255,255,0.03)' : '#F1F5F9'),
                          color: isActive ? 'var(--accent-primary, #3B82F6)' : 'var(--text-secondary)',
                          border: isActive
                            ? '1px solid var(--accent-primary, #3B82F6)'
                            : '1px solid var(--border-color)',
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Workflow Action Mode
                </label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '6px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setTabGroupMode('generate')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      fontSize: '0.71875rem',
                      fontWeight: tabGroupMode === 'generate' ? 600 : 500,
                      backgroundColor: tabGroupMode === 'generate'
                        ? (isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF')
                        : (isDark ? 'rgba(255, 255, 255, 0.02)' : '#FFFFFF'),
                      color: tabGroupMode === 'generate' ? 'var(--text-primary)' : 'var(--text-secondary)',
                      border: tabGroupMode === 'generate'
                        ? '1px solid var(--accent-primary, #3B82F6)'
                        : '1px solid var(--border-color)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.12s ease',
                    }}
                  >
                    <FiImage size={14} style={{ color: tabGroupMode === 'generate' ? 'var(--accent-primary, #3B82F6)' : 'var(--text-muted)', flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div>Generate Image</div>
                      <div style={{ fontSize: '0.59375rem', color: 'var(--text-muted)' }}>1 Tab · Composite</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTabGroupMode('enhance')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      fontSize: '0.71875rem',
                      fontWeight: tabGroupMode === 'enhance' ? 600 : 500,
                      backgroundColor: tabGroupMode === 'enhance'
                        ? (isDark ? 'rgba(16, 185, 129, 0.1)' : '#ECFDF5')
                        : (isDark ? 'rgba(255, 255, 255, 0.02)' : '#FFFFFF'),
                      color: tabGroupMode === 'enhance' ? 'var(--text-primary)' : 'var(--text-secondary)',
                      border: tabGroupMode === 'enhance'
                        ? '1px solid #10B981'
                        : '1px solid var(--border-color)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.12s ease',
                    }}
                  >
                    <FiSliders size={14} style={{ color: tabGroupMode === 'enhance' ? '#10B981' : 'var(--text-muted)', flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div>Enhance Images</div>
                      <div style={{ fontSize: '0.59375rem', color: 'var(--text-muted)' }}>Batch Worker Tabs</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* 3. Dynamic Pipeline Settings (Based on Action Mode) */}
              {tabGroupMode === 'generate' ? (
                /* ── COMPOSITE GENERATE MODE PIPELINE ── */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {/* Feature 1: Reference Layout Photo */}
                  <div
                    style={{
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '24px', height: '24px', borderRadius: '5px', backgroundColor: isDark ? 'rgba(236, 72, 153, 0.12)' : '#FDF2F8', color: '#EC4899', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FiImage size={13} />
                        </div>
                        <div>
                          <div style={{ fontSize: '0.71875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            Reference Layout (1st in Chat)
                          </div>
                          <div style={{ fontSize: '0.59375rem', color: 'var(--text-muted)' }}>
                            Example design attached first to guide composition
                          </div>
                        </div>
                      </div>
                      <ToggleSwitch
                        checked={useReferenceImage}
                        onChange={(val) => setUseReferenceImage(val)}
                        size="sm"
                        activeColor="#EC4899"
                      />
                    </div>

                    {useReferenceImage && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '4px', borderTop: '1px solid var(--border-color)' }}>
                        <input
                          type="text"
                          value={referenceImageUrl}
                          onChange={(e) => setReferenceImageUrl(e.target.value)}
                          placeholder="Paste reference image URL or leave blank to pick on canvas..."
                          style={{
                            flex: 1,
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#FFFFFF',
                            color: 'var(--text-primary)',
                            fontSize: '0.625rem',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const sample = propertyImages[0]?.url || '';
                            if (sample) setReferenceImageUrl(sample);
                          }}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '0.625rem',
                            fontWeight: 500,
                            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0',
                            color: 'var(--text-secondary)',
                            border: '1px solid var(--border-color)',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Use First Photo
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Feature 2: Condo Building Photos */}
                  <div
                    style={{
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '24px', height: '24px', borderRadius: '5px', backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ECFDF5', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FiFolder size={13} />
                        </div>
                        <div>
                          <div style={{ fontSize: '0.71875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            Condo Building Photos (2nd in Chat)
                          </div>
                          <div style={{ fontSize: '0.59375rem', color: 'var(--text-muted)' }}>
                            From ~/Desktop/Condo Building subfolder
                          </div>
                        </div>
                      </div>
                      <ToggleSwitch
                        checked={useCondoImages}
                        onChange={(val) => setUseCondoImages(val)}
                        size="sm"
                        activeColor="#10B981"
                      />
                    </div>

                    {useCondoImages && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px', borderTop: '1px solid var(--border-color)' }}>
                        <span style={{ fontSize: '0.59375rem', color: 'var(--text-muted)' }}>Photos to attach:</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {[
                            { count: 1, label: '1 Photo (#1)' },
                            { count: 2, label: '2 Photos (#1 & #2)' },
                            { count: 3, label: '3 Photos (All 3)' },
                          ].map((opt) => {
                            const isSel = condoImagesCount === opt.count;
                            return (
                              <button
                                key={opt.count}
                                type="button"
                                onClick={() => setCondoImagesCount(opt.count)}
                                style={{
                                  padding: '2px 7px',
                                  borderRadius: '4px',
                                  fontSize: '0.59375rem',
                                  fontWeight: isSel ? 600 : 500,
                                  backgroundColor: isSel
                                    ? (isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5')
                                    : 'transparent',
                                  color: isSel ? '#10B981' : 'var(--text-secondary)',
                                  border: isSel
                                    ? '1px solid rgba(16, 185, 129, 0.35)'
                                    : '1px solid var(--border-color)',
                                  cursor: 'pointer',
                                }}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Feature 3: Interior / Enhanced Photos */}
                  <div
                    style={{
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '24px', height: '24px', borderRadius: '5px', backgroundColor: isDark ? 'rgba(139, 92, 246, 0.12)' : '#F5F3FF', color: '#8B5CF6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FiLayers size={13} />
                        </div>
                        <div>
                          <div style={{ fontSize: '0.71875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            Interior / Enhanced Photos (3rd in Chat)
                          </div>
                          <div style={{ fontSize: '0.59375rem', color: 'var(--text-muted)' }}>
                            Enhanced room photos attached together
                          </div>
                        </div>
                      </div>
                      <ToggleSwitch
                        checked={useEnhancedImages}
                        onChange={(val) => setUseEnhancedImages(val)}
                        size="sm"
                        activeColor="#8B5CF6"
                      />
                    </div>

                    {useEnhancedImages && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingTop: '4px', borderTop: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.59375rem', color: 'var(--text-muted)' }}>Source:</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button
                              type="button"
                              onClick={() => setEnhancedImagesSource('enhanced')}
                              style={{
                                padding: '2px 7px',
                                borderRadius: '4px',
                                fontSize: '0.59375rem',
                                fontWeight: enhancedImagesSource === 'enhanced' ? 600 : 500,
                                backgroundColor: enhancedImagesSource === 'enhanced'
                                  ? (isDark ? 'rgba(139, 92, 246, 0.15)' : '#F5F3FF')
                                  : 'transparent',
                                color: enhancedImagesSource === 'enhanced' ? '#8B5CF6' : 'var(--text-secondary)',
                                border: enhancedImagesSource === 'enhanced'
                                  ? '1px solid rgba(139, 92, 246, 0.35)'
                                  : '1px solid var(--border-color)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <FiCheckCircle size={10} />
                              <span>Enhanced</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setEnhancedImagesSource('get_images')}
                              style={{
                                padding: '2px 7px',
                                borderRadius: '4px',
                                fontSize: '0.59375rem',
                                fontWeight: enhancedImagesSource === 'get_images' ? 600 : 500,
                                backgroundColor: enhancedImagesSource === 'get_images'
                                  ? (isDark ? 'rgba(139, 92, 246, 0.15)' : '#F5F3FF')
                                  : 'transparent',
                                color: enhancedImagesSource === 'get_images' ? '#8B5CF6' : 'var(--text-secondary)',
                                border: enhancedImagesSource === 'get_images'
                                  ? '1px solid rgba(139, 92, 246, 0.35)'
                                  : '1px solid var(--border-color)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <FiFolder size={10} />
                              <span>Get Images</span>
                            </button>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
                          <span style={{ fontSize: '0.59375rem', color: 'var(--text-muted)' }}>Photos to attach:</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {[1, 3, 5, 99].map((count) => {
                              const isSel = enhancedImagesCount === count;
                              return (
                                <button
                                  key={count}
                                  type="button"
                                  onClick={() => setEnhancedImagesCount(count)}
                                  style={{
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontSize: '0.5625rem',
                                    fontWeight: isSel ? 600 : 500,
                                    backgroundColor: isSel
                                      ? (isDark ? 'rgba(139, 92, 246, 0.15)' : '#F5F3FF')
                                      : 'transparent',
                                    color: isSel ? '#8B5CF6' : 'var(--text-secondary)',
                                    border: isSel
                                      ? '1px solid rgba(139, 92, 246, 0.35)'
                                      : '1px solid var(--border-color)',
                                    cursor: 'pointer',
                                  }}
                                >
                                  {count === 99 ? 'All' : `${count} Photo${count > 1 ? 's' : ''}`}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Feature 4: Connected Prompt & Selection */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Connected Prompt
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedPromptSource('upstream_ai')}
                          style={{
                            padding: '2px 6px',
                            borderRadius: '3px',
                            fontSize: '0.59375rem',
                            fontWeight: selectedPromptSource === 'upstream_ai' ? 600 : 500,
                            backgroundColor: selectedPromptSource === 'upstream_ai'
                              ? (isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF')
                              : 'transparent',
                            color: selectedPromptSource === 'upstream_ai' ? 'var(--accent-primary, #3B82F6)' : 'var(--text-muted)',
                            border: selectedPromptSource === 'upstream_ai'
                              ? '1px solid var(--accent-primary, #3B82F6)'
                              : '1px solid var(--border-color)',
                            cursor: 'pointer',
                          }}
                        >
                          Canvas AI
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedPromptSource('custom')}
                          style={{
                            padding: '2px 6px',
                            borderRadius: '3px',
                            fontSize: '0.59375rem',
                            fontWeight: selectedPromptSource === 'custom' ? 600 : 500,
                            backgroundColor: selectedPromptSource === 'custom'
                              ? (isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF')
                              : 'transparent',
                            color: selectedPromptSource === 'custom' ? 'var(--accent-primary, #3B82F6)' : 'var(--text-muted)',
                            border: selectedPromptSource === 'custom'
                              ? '1px solid var(--accent-primary, #3B82F6)'
                              : '1px solid var(--border-color)',
                            cursor: 'pointer',
                          }}
                        >
                          Custom Text
                        </button>
                      </div>
                    </div>

                    {selectedPromptSource === 'upstream_ai' ? (
                      <Select
                        options={cleanPromptOptions}
                        value={selectedUpstreamAiId}
                        onChange={(val) => setSelectedUpstreamAiId(String(val))}
                        height="36px"
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
                          border: '1px solid var(--border-color)',
                          backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#FFFFFF',
                          color: 'var(--text-primary)',
                          fontSize: '0.6875rem',
                          boxSizing: 'border-box',
                        }}
                      />
                    )}
                  </div>
                </div>
              ) : (
                /* ── BATCH ENHANCE MODE PIPELINE ── */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {/* Worker Tabs Count */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC' }}>
                    <div>
                      <div style={{ fontSize: '0.71875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Worker Tabs Count
                      </div>
                      <div style={{ fontSize: '0.59375rem', color: 'var(--text-muted)' }}>
                        Parallel Chrome tabs for batch processing
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {[1, 2, 4, 6].map((count) => {
                        const isSel = workerTabsCount === count;
                        return (
                          <button
                            key={count}
                            type="button"
                            onClick={() => setWorkerTabsCount(count)}
                            style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '0.625rem',
                              fontWeight: isSel ? 600 : 500,
                              backgroundColor: isSel
                                ? (isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5')
                                : 'transparent',
                              color: isSel ? '#10B981' : 'var(--text-secondary)',
                              border: isSel
                                ? '1px solid rgba(16, 185, 129, 0.35)'
                                : '1px solid var(--border-color)',
                              cursor: 'pointer',
                            }}
                          >
                            {count} {count === 1 ? 'Tab' : 'Tabs'}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Enhancement Template */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Enhancement Preset Template
                    </label>
                    <Select
                      options={[
                        { label: 'Photo Retouch & Architectural Straightening', value: 'photo_retouch' },
                        { label: 'Clean & Bright Interior Enhancement', value: 'clean_interior' },
                        { label: 'Architectural Exterior Retouch', value: 'architectural' },
                      ]}
                      value={enhancePromptPreset}
                      onChange={(val) => setEnhancePromptPreset(String(val))}
                      height="36px"
                    />
                  </div>

                  {/* Input Source */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC' }}>
                    <div>
                      <div style={{ fontSize: '0.71875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Input Images Source
                      </div>
                      <div style={{ fontSize: '0.59375rem', color: 'var(--text-muted)' }}>
                        From Get Images node on canvas
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        type="button"
                        onClick={() => setEnhancePhotoSource('all')}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '0.625rem',
                          fontWeight: enhancePhotoSource === 'all' ? 600 : 500,
                          backgroundColor: enhancePhotoSource === 'all'
                            ? (isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5')
                            : 'transparent',
                          color: enhancePhotoSource === 'all' ? '#10B981' : 'var(--text-secondary)',
                          border: enhancePhotoSource === 'all'
                            ? '1px solid rgba(16, 185, 129, 0.35)'
                            : '1px solid var(--border-color)',
                          cursor: 'pointer',
                        }}
                      >
                        All Photos ({propertyImages.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setEnhancePhotoSource('hero_only')}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '0.625rem',
                          fontWeight: enhancePhotoSource === 'hero_only' ? 600 : 500,
                          backgroundColor: enhancePhotoSource === 'hero_only'
                            ? (isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5')
                            : 'transparent',
                          color: enhancePhotoSource === 'hero_only' ? '#10B981' : 'var(--text-secondary)',
                          border: enhancePhotoSource === 'hero_only'
                            ? '1px solid rgba(16, 185, 129, 0.35)'
                            : '1px solid var(--border-color)',
                          cursor: 'pointer',
                        }}
                      >
                        Hero Only (#1)
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Standard Site Primary Button (Apple / Clean Slate Style) */}
              <button
                type="button"
                onClick={handleCreateAndConnectFlow}
                style={{
                  width: '100%',
                  height: '38px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--accent-primary, #2563EB)',
                  color: '#FFFFFF',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  border: '1px solid var(--accent-primary, #2563EB)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginTop: '0.5rem',
                  transition: 'background-color 0.15s ease, border-color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--accent-primary-hover, #1D4ED8)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--accent-primary, #2563EB)';
                }}
              >
                <FiPlus size={14} />
                <span>Connect Flow to {browserProfileName || fromTitle}</span>
              </button>
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN: LIVE DYNAMIC PREVIEW ── */}
        <div
          style={{
            overflowY: 'auto',
            padding: '1.25rem',
            backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FiEye size={13} style={{ color: 'var(--accent-primary, #3B82F6)' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Workflow Preview
              </span>
            </div>
            <span
              style={{
                fontSize: '0.625rem',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '12px',
                backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ECFDF5',
                color: '#10B981',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <FiCheck size={10} />
              <span>Ready to Connect</span>
            </span>
          </div>

          {/* 1. Canvas Node Flow Visualization */}
          <div
            style={{
              padding: '0.85rem 1rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: isDark ? '#161B22' : '#FFFFFF',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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
                  borderRadius: '5px',
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F1F5F9',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                <FiMonitor size={11} style={{ color: 'var(--accent-primary, #3B82F6)' }} />
                <span>{browserProfileName || fromTitle}</span>
              </div>

              <FiArrowRight size={11} style={{ color: 'var(--text-muted)' }} />

              {/* Flow Child Node */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '4px 8px',
                  borderRadius: '5px',
                  backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  color: 'var(--accent-primary, #3B82F6)',
                }}
              >
                <FiLayers size={11} />
                <span>
                  {flowName || 'Tab Group'} ({tabGroupMode === 'generate' ? 1 : workerTabsCount} Tab{workerTabsCount > 1 && tabGroupMode === 'enhance' ? 's' : ''})
                </span>
              </div>

              {tabGroupMode === 'generate' && selectedPromptSource === 'upstream_ai' && selectedAiBox && (
                <>
                  <FiArrowRight size={11} style={{ color: 'var(--text-muted)' }} />
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 8px',
                      borderRadius: '5px',
                      backgroundColor: isDark ? 'rgba(139, 92, 246, 0.1)' : '#F5F3FF',
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      color: '#8B5CF6',
                      maxWidth: '180px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <FiFileText size={11} />
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
              padding: '0.85rem 1rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: isDark ? '#161B22' : '#FFFFFF',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                ChatGPT Automation Preview
              </span>
              <span style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                {tabGroupMode === 'generate' ? `${totalCompositePhotos} Photo(s) Attached` : `${workerTabsCount} Concurrent Tabs`}
              </span>
            </div>

            {/* Simulated ChatGPT Input Composer Box */}
            <div
              style={{
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: isDark ? 'rgba(0, 0, 0, 0.25)' : '#F8FAFC',
                padding: '8px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {tabGroupMode === 'generate' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* Visual Attachment Sequence Strip */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    {useReferenceImage && (
                      <div
                        style={{
                          padding: '2px 7px',
                          borderRadius: '4px',
                          backgroundColor: isDark ? 'rgba(236, 72, 153, 0.12)' : '#FDF2F8',
                          border: '1px solid rgba(236, 72, 153, 0.25)',
                          color: '#EC4899',
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

                    {useCondoImages && (
                      <div
                        style={{
                          padding: '2px 7px',
                          borderRadius: '4px',
                          backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ECFDF5',
                          border: '1px solid rgba(16, 185, 129, 0.25)',
                          color: '#10B981',
                          fontSize: '0.59375rem',
                          fontWeight: 500,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <FiFolder size={10} />
                        <span>Condo ({condoImagesCount} Photos)</span>
                      </div>
                    )}

                    {useEnhancedImages && (
                      <div
                        style={{
                          padding: '2px 7px',
                          borderRadius: '4px',
                          backgroundColor: isDark ? 'rgba(139, 92, 246, 0.12)' : '#F5F3FF',
                          border: '1px solid rgba(139, 92, 246, 0.25)',
                          color: '#8B5CF6',
                          fontSize: '0.59375rem',
                          fontWeight: 500,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <FiLayers size={10} />
                        <span>{enhancedImagesSource === 'enhanced' ? 'Enhanced' : 'Source'} ({enhancedImagesCount} Photos)</span>
                      </div>
                    )}
                  </div>

                  {/* Thumbnail Preview Strip */}
                  {((useCondoImages && propertyImages.length > 0) || (useEnhancedImages && (enhancedImages.length > 0 || propertyImages.length > 0))) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', overflowX: 'auto', padding: '2px 0' }}>
                      {useReferenceImage && (
                        <div
                          style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '5px',
                            border: '1.5px solid #EC4899',
                            overflow: 'hidden',
                            flexShrink: 0,
                            position: 'relative',
                            backgroundColor: '#1E293B',
                          }}
                        >
                          {referenceImageUrl ? (
                            <img src={referenceImageUrl} alt="Ref" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EC4899', fontSize: '9px' }}>Ref #1</div>
                          )}
                          <span style={{ position: 'absolute', bottom: 1, right: 1, backgroundColor: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '7px', padding: '1px 2px', borderRadius: '2px' }}>#1</span>
                        </div>
                      )}
                      {useCondoImages && propertyImages.slice(0, condoImagesCount).map((img, i) => (
                        <div
                          key={`condo-${i}`}
                          style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '5px',
                            border: '1.5px solid #10B981',
                            overflow: 'hidden',
                            flexShrink: 0,
                            position: 'relative',
                            backgroundColor: '#1E293B',
                          }}
                        >
                          <img src={img.url} alt={`Condo ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <span style={{ position: 'absolute', bottom: 1, right: 1, backgroundColor: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '7px', padding: '1px 2px', borderRadius: '2px' }}>C{i + 1}</span>
                        </div>
                      ))}
                      {useEnhancedImages && (enhancedImagesSource === 'enhanced' && enhancedImages.length > 0 ? enhancedImages : propertyImages)
                        .slice(0, enhancedImagesCount)
                        .map((img, i) => (
                          <div
                            key={`enh-${i}`}
                            style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '5px',
                              border: '1.5px solid #8B5CF6',
                              overflow: 'hidden',
                              flexShrink: 0,
                              position: 'relative',
                              backgroundColor: '#1E293B',
                            }}
                          >
                            <img src={img.url} alt={`Photo ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <span style={{ position: 'absolute', bottom: 1, right: 1, backgroundColor: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '7px', padding: '1px 2px', borderRadius: '2px' }}>P{i + 1}</span>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Clean Truncated Prompt Preview */}
                  <div
                    style={{
                      fontSize: '0.6875rem',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.45,
                      maxHeight: '64px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      fontStyle: 'italic',
                      opacity: 0.9,
                    }}
                  >
                    "{selectedPromptSource === 'custom'
                      ? customPromptText
                      : (selectedAiBox?.generatedOutput || selectedAiBox?.text || 'Prompt will be dynamically generated by connected AI Box.')}"
                  </div>

                  {/* Composer Input Bottom Bar */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.59375rem', color: 'var(--text-muted)' }}>
                      <FiCpu size={10} />
                      <span>ChatGPT 4o</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FiPaperclip size={12} style={{ color: 'var(--text-muted)' }} />
                      <div
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--accent-primary, #2563EB)',
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <FiArrowUp size={11} />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Enhance Mode Preview */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10B981', fontWeight: 600, fontSize: '0.6875rem' }}>
                    <FiSliders size={12} />
                    <span>Batch Worker Tabs Automation ({workerTabsCount} Tabs)</span>
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.625rem', lineHeight: 1.4 }}>
                    Each tab in profile "{browserProfileName || fromTitle}" receives 1 incoming photo with the "{enhancePromptPreset.replace(/_/g, ' ')}" template, executed concurrently.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 3. Execution Blueprint Summary */}
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: isDark ? '#161B22' : '#FFFFFF',
              fontSize: '0.6875rem',
              color: 'var(--text-muted)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Execution Summary
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FiCheckCircle size={12} style={{ color: '#10B981' }} />
              <span>Target Profile: <strong style={{ color: 'var(--text-primary)' }}>{browserProfileName || fromTitle}</strong></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FiCheckCircle size={12} style={{ color: '#10B981' }} />
              <span>
                {tabGroupMode === 'generate'
                  ? `Staging Mode: 1 Tab with ${totalCompositePhotos} Photos Attached`
                  : `Batch Mode: ${workerTabsCount} Concurrent Worker Tabs`}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FiCheckCircle size={12} style={{ color: '#10B981' }} />
              <span>Condo / Project Context: <strong style={{ color: 'var(--text-primary)' }}>{condoName}</strong></span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
