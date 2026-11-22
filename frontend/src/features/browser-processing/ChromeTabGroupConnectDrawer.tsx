import React, { useState, useMemo } from 'react';
import {
  FiLayers,
  FiX,
  FiPlus,
  FiZap,
  FiSliders,
  FiImage,
  FiFolder,
  FiFileText,
  FiCheck,
  FiArrowRight,
  FiExternalLink,
  FiCheckCircle,
  FiUploadCloud,
  FiMonitor,
} from 'react-icons/fi';
import { Select } from '../../components/ui/Select';
import { ToggleSwitch } from '../../components/ui/ToggleSwitch';
import { Button } from '../../components/ui/Button';
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
  const [selectedPromptSource, setSelectedPromptSource] = useState<'upstream_ai' | 'template' | 'custom'>('upstream_ai');
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
    { label: 'Facilities IMG', mode: 'enhance' as const },
  ];

  // Upstream AI Prompt Box Object
  const selectedAiBox = useMemo(() => {
    return upstreamAiBoxes.find((b) => b.id === selectedUpstreamAiId) || upstreamAiBoxes[0];
  }, [upstreamAiBoxes, selectedUpstreamAiId]);

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
      {/* ── HEADER ── */}
      <div
        style={{
          padding: '0.875rem 1.25rem',
          borderBottom: '1px solid var(--border-color, #30363D)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: isDark
            ? 'linear-gradient(180deg, #161B22 0%, #0D1117 100%)'
            : '#FFFFFF',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              backgroundColor: 'rgba(6, 182, 212, 0.15)',
              color: '#06B6D4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              flexShrink: 0,
            }}
          >
            <FiLayers size={18} />
          </div>
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: '0.9375rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              Connect Chrome Tab Group
              <span
                style={{
                  fontSize: '0.625rem',
                  fontWeight: 600,
                  padding: '2px 7px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(6, 182, 212, 0.14)',
                  color: '#06B6D4',
                  border: '1px solid rgba(6, 182, 212, 0.3)',
                }}
              >
                Dynamic Flow Builder
              </span>
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              Attach dynamic browser automation flow to {browserProfileName || fromTitle}
            </p>
          </div>
        </div>

        {/* View Switcher & Close */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: isDark ? 'rgba(0,0,0,0.35)' : '#F1F5F9',
              borderRadius: '7px',
              padding: '2px',
              border: '1px solid var(--border-color)',
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('custom_flow')}
              style={{
                padding: '4px 10px',
                borderRadius: '5px',
                fontSize: '0.6875rem',
                fontWeight: activeTab === 'custom_flow' ? 700 : 500,
                backgroundColor: activeTab === 'custom_flow' ? (isDark ? '#238636' : '#16A34A') : 'transparent',
                color: activeTab === 'custom_flow' ? '#FFFFFF' : 'var(--text-muted)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.15s ease',
              }}
            >
              <FiZap size={12} />
              <span>Create Flow</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('discovered_groups')}
              style={{
                padding: '4px 10px',
                borderRadius: '5px',
                fontSize: '0.6875rem',
                fontWeight: activeTab === 'discovered_groups' ? 700 : 500,
                backgroundColor: activeTab === 'discovered_groups' ? (isDark ? '#30363D' : '#E2E8F0') : 'transparent',
                color: activeTab === 'discovered_groups' ? 'var(--text-primary)' : 'var(--text-muted)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.15s ease',
              }}
            >
              <FiLayers size={12} />
              <span>Discovered ({discoveredTabGroups.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '5px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px',
            }}
          >
            <FiX size={16} />
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
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Discovered in {browserProfileName || fromTitle}:
                </span>
                <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                  Click to quick-connect or customize
                </span>
              </div>

              {discoveredTabGroups.map((g) => (
                <div
                  key={g.id || g.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 0.85rem',
                    borderRadius: '8px',
                    border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                    backgroundColor: isDark ? '#1C2128' : '#F8FAFC',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        background: 'linear-gradient(135deg, #06B6D4, #0891B2)',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <FiLayers size={16} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {g.name}
                        </span>
                        <span style={{ fontSize: '0.5625rem', padding: '1px 5px', borderRadius: '3px', backgroundColor: isDark ? '#30363D' : '#E2E8F0', color: isDark ? '#8B949E' : '#64748B', fontWeight: 600 }}>
                          {g.tabs?.length || g.tabs_count || 0} tabs
                        </span>
                      </div>
                      <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>
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
                        borderRadius: '5px',
                        fontSize: '0.625rem',
                        fontWeight: 600,
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
                        padding: '4px 10px',
                        borderRadius: '5px',
                        fontSize: '0.625rem',
                        fontWeight: 700,
                        backgroundColor: '#06B6D4',
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
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  No tab groups open in Chrome yet. You can build a new flow using the Custom Flow builder!
                </div>
              )}
            </div>
          ) : (
            /* ═══════════════════════════════════════════════════════════════════ */
            /* VIEW 2: CUSTOM FLOW BUILDER (DYNAMIC WORKFLOW CONFIG)              */
            /* ═══════════════════════════════════════════════════════════════════ */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* 1. Flow Name & Quick Presets */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Flow / Tab Group Name:
                </label>
                <input
                  type="text"
                  value={flowName}
                  onChange={(e) => setFlowName(e.target.value)}
                  placeholder="e.g. FB Hero, Enhance IMG, Tiktok Hero"
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: '7px',
                    fontSize: '0.78125rem',
                    fontWeight: 600,
                    border: '1px solid var(--border-color)',
                    backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#FFFFFF',
                    color: 'var(--text-primary)',
                  }}
                />

                {/* Quick Presets Pills */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap', marginTop: '2px' }}>
                  <span style={{ fontSize: '0.59375rem', color: 'var(--text-muted)' }}>Quick Templates:</span>
                  {flowNamePresets.map((p) => (
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
                        fontWeight: flowName === p.label ? 700 : 500,
                        backgroundColor: flowName === p.label
                          ? (isDark ? 'rgba(6, 182, 212, 0.2)' : '#ECFEFF')
                          : (isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9'),
                        color: flowName === p.label ? '#06B6D4' : 'var(--text-secondary)',
                        border: flowName === p.label ? '1px solid rgba(6, 182, 212, 0.4)' : '1px solid var(--border-color)',
                        cursor: 'pointer',
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Action Mode Switcher */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Workflow Action Mode:
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '3px',
                    borderRadius: '8px',
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
                      padding: '7px 8px',
                      borderRadius: '6px',
                      fontSize: '0.6875rem',
                      fontWeight: tabGroupMode === 'generate' ? 700 : 500,
                      backgroundColor: tabGroupMode === 'generate'
                        ? (isDark ? 'rgba(59, 130, 246, 0.25)' : '#FFFFFF')
                        : 'transparent',
                      color: tabGroupMode === 'generate' ? '#3B82F6' : 'var(--text-muted)',
                      border: tabGroupMode === 'generate' ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                    }}
                  >
                    <FiZap size={13} />
                    <span>Generate Image (Composite)</span>
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
                      padding: '7px 8px',
                      borderRadius: '6px',
                      fontSize: '0.6875rem',
                      fontWeight: tabGroupMode === 'enhance' ? 700 : 500,
                      backgroundColor: tabGroupMode === 'enhance'
                        ? (isDark ? 'rgba(16, 185, 129, 0.25)' : '#FFFFFF')
                        : 'transparent',
                      color: tabGroupMode === 'enhance' ? '#10B981' : 'var(--text-muted)',
                      border: tabGroupMode === 'enhance' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                    }}
                  >
                    <FiSliders size={13} />
                    <span>Enhance Images (Batch Workers)</span>
                  </button>
                </div>
              </div>

              {/* 3. Dynamic Pipeline Settings (Based on Action Mode) */}
              {tabGroupMode === 'generate' ? (
                /* ── COMPOSITE GENERATE MODE PIPELINE ── */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {/* Feature 1: Reference Layout */}
                  <div
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '24px', height: '24px', borderRadius: '5px', backgroundColor: 'rgba(236, 72, 153, 0.12)', color: '#EC4899', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

                  {/* Feature 2: Condo Building Photos */}
                  <div
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '24px', height: '24px', borderRadius: '5px', backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                          ].map((opt) => (
                            <button
                              key={opt.count}
                              type="button"
                              onClick={() => setCondoImagesCount(opt.count)}
                              style={{
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '0.5625rem',
                                fontWeight: condoImagesCount === opt.count ? 700 : 500,
                                backgroundColor: condoImagesCount === opt.count ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                                color: condoImagesCount === opt.count ? '#10B981' : 'var(--text-secondary)',
                                border: condoImagesCount === opt.count ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-color)',
                                cursor: 'pointer',
                              }}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Feature 3: Interior / Enhanced Photos */}
                  <div
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '24px', height: '24px', borderRadius: '5px', backgroundColor: 'rgba(139, 92, 246, 0.12)', color: '#8B5CF6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FiZap size={13} />
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
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '0.5625rem',
                                fontWeight: enhancedImagesSource === 'enhanced' ? 700 : 500,
                                backgroundColor: enhancedImagesSource === 'enhanced' ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                                color: enhancedImagesSource === 'enhanced' ? '#8B5CF6' : 'var(--text-secondary)',
                                border: enhancedImagesSource === 'enhanced' ? '1px solid rgba(139, 92, 246, 0.4)' : '1px solid var(--border-color)',
                                cursor: 'pointer',
                              }}
                            >
                              ✨ Enhanced
                            </button>
                            <button
                              type="button"
                              onClick={() => setEnhancedImagesSource('get_images')}
                              style={{
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '0.5625rem',
                                fontWeight: enhancedImagesSource === 'get_images' ? 700 : 500,
                                backgroundColor: enhancedImagesSource === 'get_images' ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                                color: enhancedImagesSource === 'get_images' ? '#8B5CF6' : 'var(--text-secondary)',
                                border: enhancedImagesSource === 'get_images' ? '1px solid rgba(139, 92, 246, 0.4)' : '1px solid var(--border-color)',
                                cursor: 'pointer',
                              }}
                            >
                              📷 Get Images
                            </button>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.59375rem', color: 'var(--text-muted)' }}>Photos to attach:</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {[
                              { count: 1, label: '1 Photo' },
                              { count: 3, label: '3 Photos' },
                              { count: 5, label: '5 Photos' },
                              { count: 10, label: 'All' },
                            ].map((opt) => (
                              <button
                                key={opt.count}
                                type="button"
                                onClick={() => setEnhancedImagesCount(opt.count)}
                                style={{
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '0.5625rem',
                                  fontWeight: enhancedImagesCount === opt.count ? 700 : 500,
                                  backgroundColor: enhancedImagesCount === opt.count ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                                  color: enhancedImagesCount === opt.count ? '#8B5CF6' : 'var(--text-secondary)',
                                  border: enhancedImagesCount === opt.count ? '1px solid rgba(139, 92, 246, 0.4)' : '1px solid var(--border-color)',
                                  cursor: 'pointer',
                                }}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Feature 4: Prompt Connection */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ fontSize: '0.71875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Connected Prompt:
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedPromptSource('upstream_ai')}
                          style={{
                            padding: '1px 6px',
                            borderRadius: '3px',
                            fontSize: '0.5625rem',
                            fontWeight: selectedPromptSource === 'upstream_ai' ? 700 : 500,
                            backgroundColor: selectedPromptSource === 'upstream_ai' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                            color: selectedPromptSource === 'upstream_ai' ? '#3B82F6' : 'var(--text-muted)',
                            border: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          Canvas AI
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedPromptSource('custom')}
                          style={{
                            padding: '1px 6px',
                            borderRadius: '3px',
                            fontSize: '0.5625rem',
                            fontWeight: selectedPromptSource === 'custom' ? 700 : 500,
                            backgroundColor: selectedPromptSource === 'custom' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                            color: selectedPromptSource === 'custom' ? '#3B82F6' : 'var(--text-muted)',
                            border: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          Custom
                        </button>
                      </div>
                    </div>

                    {selectedPromptSource === 'upstream_ai' ? (
                      <Select
                        options={upstreamAiBoxes.map((b) => ({
                          label: `🤖 ${b.title} (Canvas AI)`,
                          value: b.id,
                        }))}
                        value={selectedUpstreamAiId}
                        onChange={(val) => setSelectedUpstreamAiId(String(val))}
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
                        }}
                      />
                    )}
                  </div>
                </div>
              ) : (
                /* ── BATCH ENHANCE MODE PIPELINE ── */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {/* Worker Tabs Count */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC' }}>
                    <div>
                      <div style={{ fontSize: '0.71875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Worker Tabs Count
                      </div>
                      <div style={{ fontSize: '0.59375rem', color: 'var(--text-muted)' }}>
                        Parallel Chrome tabs for batch image processing
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {[1, 2, 4, 6].map((count) => (
                        <button
                          key={count}
                          type="button"
                          onClick={() => setWorkerTabsCount(count)}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '0.625rem',
                            fontWeight: workerTabsCount === count ? 700 : 500,
                            backgroundColor: workerTabsCount === count ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                            color: workerTabsCount === count ? '#10B981' : 'var(--text-secondary)',
                            border: workerTabsCount === count ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-color)',
                            cursor: 'pointer',
                          }}
                        >
                          {count} {count === 1 ? 'Tab' : 'Tabs'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Enhancement Template */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.71875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Enhancement Preset Template:
                    </label>
                    <Select
                      options={[
                        { label: '✨ Photo Retouch & Lighting', value: 'photo_retouch' },
                        { label: '🏠 Real Estate Clean & Bright Interior', value: 'clean_interior' },
                        { label: '🏢 Architectural Exterior Enhancement', value: 'architectural' },
                      ]}
                      value={enhancePromptPreset}
                      onChange={(val) => setEnhancePromptPreset(String(val))}
                    />
                  </div>

                  {/* Input Source */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC' }}>
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
                          fontWeight: enhancePhotoSource === 'all' ? 700 : 500,
                          backgroundColor: enhancePhotoSource === 'all' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                          color: enhancePhotoSource === 'all' ? '#10B981' : 'var(--text-secondary)',
                          border: enhancePhotoSource === 'all' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-color)',
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
                          fontWeight: enhancePhotoSource === 'hero_only' ? 700 : 500,
                          backgroundColor: enhancePhotoSource === 'hero_only' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                          color: enhancePhotoSource === 'hero_only' ? '#10B981' : 'var(--text-secondary)',
                          border: enhancePhotoSource === 'hero_only' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-color)',
                          cursor: 'pointer',
                        }}
                      >
                        Hero Only (#1)
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Big Action Button */}
              <button
                type="button"
                onClick={handleCreateAndConnectFlow}
                style={{
                  width: '100%',
                  height: '42px',
                  borderRadius: '8px',
                  backgroundColor: '#06B6D4',
                  color: '#FFFFFF',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 8px rgba(6, 182, 212, 0.35)',
                  marginTop: '0.5rem',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#0891B2';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#06B6D4';
                }}
              >
                <FiZap size={15} />
                <span>Create & Connect Flow to {browserProfileName || fromTitle}</span>
              </button>
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN: LIVE DYNAMIC PREVIEW ── */}
        <div
          style={{
            overflowY: 'auto',
            padding: '1.25rem',
            backgroundColor: isDark ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              ⚡ Live Workflow Flow Preview
            </span>
            <span style={{ fontSize: '0.5625rem', fontWeight: 700, padding: '2px 7px', borderRadius: '10px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10B981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              ● Ready to Connect
            </span>
          </div>

          {/* 1. Canvas Node Flow Visualization */}
          <div
            style={{
              padding: '1rem',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
              backgroundColor: isDark ? '#161B22' : '#FFFFFF',
              boxShadow: isDark ? '0 2px 6px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              CANVAS NODE HIERARCHY
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* Chrome Profile Parent */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 9px',
                  borderRadius: '6px',
                  backgroundColor: isDark ? 'rgba(6, 182, 212, 0.12)' : '#ECFEFF',
                  border: '1px solid rgba(6, 182, 212, 0.35)',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  color: '#06B6D4',
                }}
              >
                <FiMonitor size={12} />
                <span>{browserProfileName || fromTitle}</span>
              </div>

              <FiArrowRight size={13} style={{ color: 'var(--text-muted)' }} />

              {/* New Tab Group Node */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  backgroundColor: tabGroupMode === 'generate'
                    ? (isDark ? 'rgba(59, 130, 246, 0.2)' : '#EFF6FF')
                    : (isDark ? 'rgba(16, 185, 129, 0.2)' : '#F0FDF4'),
                  border: tabGroupMode === 'generate'
                    ? '1px solid rgba(59, 130, 246, 0.5)'
                    : '1px solid rgba(16, 185, 129, 0.5)',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  color: tabGroupMode === 'generate' ? '#3B82F6' : '#10B981',
                }}
              >
                <FiLayers size={12} />
                <span>{flowName || 'Tab Group'}</span>
                <span style={{ fontSize: '0.5625rem', opacity: 0.8 }}>
                  ({tabGroupMode === 'generate' ? '1 Tab' : `${workerTabsCount} Tabs`})
                </span>
              </div>

              {selectedAiBox && tabGroupMode === 'generate' && selectedPromptSource === 'upstream_ai' && (
                <>
                  <FiArrowRight size={13} style={{ color: 'var(--text-muted)' }} />
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 8px',
                      borderRadius: '5px',
                      backgroundColor: isDark ? 'rgba(139, 92, 246, 0.15)' : '#F5F3FF',
                      border: '1px solid rgba(139, 92, 246, 0.35)',
                      fontSize: '0.625rem',
                      fontWeight: 600,
                      color: '#8B5CF6',
                      maxWidth: '120px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={selectedAiBox.title}
                  >
                    <FiFileText size={11} />
                    <span>{selectedAiBox.title}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 2. Mock ChatGPT Composer Attachment Pipeline Preview */}
          <div
            style={{
              padding: '1rem',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
              backgroundColor: isDark ? '#161B22' : '#FFFFFF',
              boxShadow: isDark ? '0 2px 6px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                CHATGPT COMPOSER ATTACHMENTS PREVIEW
              </span>
              <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#3B82F6' }}>
                Total: {tabGroupMode === 'generate' ? totalCompositePhotos : 1} Photo(s)
              </span>
            </div>

            {tabGroupMode === 'generate' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Visual Attachment Sequence Strip */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  {useReferenceImage && (
                    <div
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(236, 72, 153, 0.15)',
                        border: '1px solid rgba(236, 72, 153, 0.35)',
                        color: '#EC4899',
                        fontSize: '0.625rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <FiImage size={11} />
                      <span>#1: Ref Photo</span>
                    </div>
                  )}

                  {useCondoImages && (
                    <div
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid rgba(16, 185, 129, 0.35)',
                        color: '#10B981',
                        fontSize: '0.625rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <FiFolder size={11} />
                      <span>#2: Condo ({condoImagesCount} Photos)</span>
                    </div>
                  )}

                  {useEnhancedImages && (
                    <div
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(139, 92, 246, 0.15)',
                        border: '1px solid rgba(139, 92, 246, 0.35)',
                        color: '#8B5CF6',
                        fontSize: '0.625rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <FiZap size={11} />
                      <span>#3: {enhancedImagesSource === 'enhanced' ? 'Enhanced' : 'Source'} ({enhancedImagesCount} Photos)</span>
                    </div>
                  )}
                </div>

                {/* Thumbnail Preview Strip */}
                {((useCondoImages && propertyImages.length > 0) || (useEnhancedImages && (enhancedImages.length > 0 || propertyImages.length > 0))) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', padding: '4px 0' }}>
                    {useReferenceImage && (
                      <div
                        style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '6px',
                          border: '2px solid #EC4899',
                          overflow: 'hidden',
                          flexShrink: 0,
                          position: 'relative',
                          backgroundColor: '#1E293B',
                        }}
                      >
                        {referenceImageUrl ? (
                          <img src={referenceImageUrl} alt="Ref" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EC4899', fontSize: '10px' }}>Ref #1</div>
                        )}
                        <span style={{ position: 'absolute', bottom: 1, right: 1, backgroundColor: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '8px', padding: '1px 3px', borderRadius: '3px' }}>#1</span>
                      </div>
                    )}
                    {useCondoImages && propertyImages.slice(0, condoImagesCount).map((img, i) => (
                      <div
                        key={`condo-${i}`}
                        style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '6px',
                          border: '2px solid #10B981',
                          overflow: 'hidden',
                          flexShrink: 0,
                          position: 'relative',
                          backgroundColor: '#1E293B',
                        }}
                      >
                        <img src={img.url} alt={`Condo ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <span style={{ position: 'absolute', bottom: 1, right: 1, backgroundColor: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '8px', padding: '1px 3px', borderRadius: '3px' }}>C{i + 1}</span>
                      </div>
                    ))}
                    {useEnhancedImages && (enhancedImagesSource === 'enhanced' && enhancedImages.length > 0 ? enhancedImages : propertyImages)
                      .slice(0, enhancedImagesCount)
                      .map((img, i) => (
                        <div
                          key={`enh-${i}`}
                          style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '6px',
                            border: '2px solid #8B5CF6',
                            overflow: 'hidden',
                            flexShrink: 0,
                            position: 'relative',
                            backgroundColor: '#1E293B',
                          }}
                        >
                          <img src={img.url} alt={`Photo ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <span style={{ position: 'absolute', bottom: 1, right: 1, backgroundColor: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '8px', padding: '1px 3px', borderRadius: '3px' }}>P{i + 1}</span>
                        </div>
                      ))}
                  </div>
                )}

                {/* Prompt Preview Bubble */}
                <div
                  style={{
                    padding: '8px 10px',
                    borderRadius: '7px',
                    backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : '#F8FAFC',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.65625rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.4,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px', color: 'var(--text-primary)', fontWeight: 600 }}>
                    <FiFileText size={11} />
                    <span>
                      Prompt: {selectedPromptSource === 'upstream_ai' ? (selectedAiBox?.title || 'Canvas AI Prompt') : 'Custom Text Prompt'}
                    </span>
                  </div>
                  <div style={{ fontStyle: 'italic', opacity: 0.85 }}>
                    "{selectedPromptSource === 'custom'
                      ? customPromptText
                      : (selectedAiBox?.generatedOutput || selectedAiBox?.text || 'Prompt will be dynamically generated by the connected AI Box.')}"
                  </div>
                </div>
              </div>
            ) : (
              /* Enhance Mode Preview */
              <div
                style={{
                  padding: '8px 10px',
                  borderRadius: '7px',
                  backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : '#F8FAFC',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.65625rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ color: '#10B981', fontWeight: 600 }}>
                  ⚡ Batch Worker Tabs Automation ({workerTabsCount} Tabs)
                </div>
                <div style={{ color: 'var(--text-muted)' }}>
                  Each tab in profile "{browserProfileName || fromTitle}" receives 1 incoming photo + "{enhancePromptPreset}" template, executed concurrently.
                </div>
              </div>
            )}
          </div>

          {/* 3. Execution Blueprint Summary */}
          <div
            style={{
              padding: '0.85rem 1rem',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : '#FFFFFF',
              fontSize: '0.6875rem',
              color: 'var(--text-muted)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              Execution Summary:
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FiCheckCircle size={13} style={{ color: '#10B981' }} />
              <span>Target Chrome: <strong>{browserProfileName || fromTitle}</strong></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FiCheckCircle size={13} style={{ color: '#10B981' }} />
              <span>
                {tabGroupMode === 'generate'
                  ? `Staging Mode: 1 Tab with ${totalCompositePhotos} Photos Attached`
                  : `Batch Mode: ${workerTabsCount} Concurrent Worker Tabs`}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FiCheckCircle size={13} style={{ color: '#10B981' }} />
              <span>Condo / Project Context: <strong>{condoName}</strong></span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
