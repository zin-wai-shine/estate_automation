import React, { useState, useEffect, useRef } from 'react';
import {
  FiSettings,
  FiX,
  FiFolder,
  FiImage,
  FiFileText,
  FiCopy,
  FiCheck,
  FiUploadCloud,
  FiRefreshCw,
  FiSliders,
  FiZap,
  FiLayers,
  FiSearch,
  FiTrash2,
  FiInfo,
  FiCheckCircle,
  FiAlertTriangle,
  FiCornerDownRight,
} from 'react-icons/fi';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { ToggleSwitch } from '../../components/ui/ToggleSwitch';
import { loadAvailablePromptTemplates } from '../facebook-import/FacebookWorkflowCanvas';
import { isEnhanceCategory, isGenerateCategory } from './browserPromptUtils';

interface FBHeroSettingsSideboxProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  boxConfig: any;
  onUpdateBoxConfig: (updated: any) => void;
  propertyContext?: {
    id?: string;
    title?: string;
    aboveBoxTitle?: string;
    upstreamPrompts?: Array<{ id: string; title: string; text?: string; templateId?: string }>;
    upstreamTabGroups?: Array<{ id: string; title: string; browserGroupName?: string }>;
    images?: Array<{ url: string; index: number; filename?: string }>;
    rawPostContent?: string;
  };
  availablePrompts?: Array<{ id: string | number; name: string; category?: string; instructions?: string; templateText?: string }>;
}

export const FBHeroSettingsSidebox: React.FC<FBHeroSettingsSideboxProps> = ({
  isOpen,
  onClose,
  isDark,
  boxConfig,
  onUpdateBoxConfig,
  propertyContext,
  availablePrompts = [],
}) => {
  // ── 1. Execution Mode (Direct to Tab 2 vs Two-Stage Browser) ───────────────
  const [stagingMode, setStagingMode] = useState<'direct_tab2' | 'two_stage_tabs'>(() => {
    if (boxConfig.stagingMode) return boxConfig.stagingMode;
    // Default to direct if upstream prompt has text, else two_stage
    const hasUpstream = (propertyContext?.upstreamPrompts && propertyContext.upstreamPrompts.length > 0);
    return hasUpstream ? 'direct_tab2' : 'two_stage_tabs';
  });


  const [referenceImageData, setReferenceImageData] = useState<string>(() => {
    return boxConfig.referenceImage || '';
  });

  // ── 3. Prompt Configuration & Preview State ───────────────────────────────
  const [promptSourceMode, setPromptSourceMode] = useState<'upstream_ai' | 'preset' | 'custom'>(() => {
    if (boxConfig.promptSourceMode) return boxConfig.promptSourceMode;
    if (propertyContext?.upstreamPrompts && propertyContext.upstreamPrompts.length > 0) return 'upstream_ai';
    return 'preset';
  });

  const [selectedUpstreamAiId, setSelectedUpstreamAiId] = useState<string>(() => {
    if (boxConfig.selectedUpstreamAiId) return boxConfig.selectedUpstreamAiId;
    return propertyContext?.upstreamPrompts?.[0]?.id || '';
  });

  const [selectedPresetId, setSelectedPresetId] = useState<string>(() => {
    return boxConfig.browserPromptTemplateKey || 'photo_retouch';
  });

  const [customPrompt, setCustomPrompt] = useState<string>(() => {
    return boxConfig.browserCustomPrompt || boxConfig.customPrompt || '';
  });

  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // ── 4. Node Classification (FB Hero vs Worker Tab Group e.g. Enhance IMG) ──
  const nodeTitle = (boxConfig.title || boxConfig.browserGroupName || '').toLowerCase();
  const isEnhance = Boolean(
    nodeTitle.includes('enhance') ||
    (!nodeTitle.includes('hero') && !nodeTitle.includes('fb') && (boxConfig.tabGroupMode === 'enhance' || boxConfig.processKind === 'enhance_images'))
  );

  const isHero = !isEnhance && Boolean(
    nodeTitle.includes('hero') ||
    nodeTitle.includes('fb') ||
    boxConfig.tabGroupMode === 'generate' ||
    boxConfig.processKind === 'generate_image'
  );

  // ── 4. Inspector Modules Toggles ───────────────────────────────────────────
  const [showCondoProjectCard, setShowCondoProjectCard] = useState<boolean>(() => {
    return boxConfig.showCondoProjectCard !== false;
  });

  const [useReferenceImage, setUseReferenceImage] = useState<boolean>(() => {
    if (boxConfig.useReferenceImage !== undefined) return boxConfig.useReferenceImage !== false;
    return isHero;
  });

  const [useCondoImages, setUseCondoImages] = useState<boolean>(() => {
    if (boxConfig.useCondoImages !== undefined) return boxConfig.useCondoImages !== false;
    return isHero;
  });

  const [showImagesToEnhance, setShowImagesToEnhance] = useState<boolean>(() => {
    if (boxConfig.showImagesToEnhance !== undefined) return boxConfig.showImagesToEnhance !== false;
    return !isHero;
  });

  const [usePromptConfig, setUsePromptConfig] = useState<boolean>(() => {
    return boxConfig.usePromptConfig !== false && boxConfig.showEnhancementPrompt !== false;
  });

  const [showEnhancementPrompt, setShowEnhancementPrompt] = useState<boolean>(() => {
    return boxConfig.usePromptConfig !== false && boxConfig.showEnhancementPrompt !== false;
  });

  const [showTabGroupsPipelines, setShowTabGroupsPipelines] = useState<boolean>(() => {
    if (boxConfig.showTabGroupsPipelines !== undefined) return boxConfig.showTabGroupsPipelines !== false;
    return !isHero;
  });

  const [workerTabMode, setWorkerTabMode] = useState<'existing_tabs' | 'new_tabs'>(() => {
    return boxConfig.workerTabMode || 'existing_tabs';
  });

  const [workerTabCount, setWorkerTabCount] = useState<number>(() => {
    return boxConfig.workerTabCount || 4;
  });

  const [reuseSessionTabs, setReuseSessionTabs] = useState<boolean>(() => {
    return boxConfig.reuseSessionTabs !== false;
  });

  // ── 5. Condo Building Images (1, 2, 3) & Folder Target State ──────────────
  const defaultBaseDir = '/Users/zinwaishine/Desktop/Condo Building';
  const [targetFolder, setTargetFolder] = useState<string>(() => {
    return (
      boxConfig.targetFolder ||
      (boxConfig.id ? localStorage.getItem(`bolthaven_condo_target_folder_${boxConfig.id}`) : null) ||
      defaultBaseDir
    );
  });

  const [condoSearchQuery, setCondoSearchQuery] = useState<string>(() => {
    return boxConfig.browserCondoName || propertyContext?.title || '';
  });

  const [isScanningFolder, setIsScanningFolder] = useState(false);
  const [isChoosingFolder, setIsChoosingFolder] = useState(false);
  const [matchedCondoInfo, setMatchedCondoInfo] = useState<any>(null);
  const [totalIndexedCondos, setTotalIndexedCondos] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize internal state whenever the target node/box changes
  useEffect(() => {
    setStagingMode(
      boxConfig.stagingMode ||
      (propertyContext?.upstreamPrompts && propertyContext.upstreamPrompts.length > 0 ? 'direct_tab2' : 'two_stage_tabs')
    );
    const resolvedRef = boxConfig.useReferenceImage !== undefined ? boxConfig.useReferenceImage !== false : isHero;
    const resolvedCondo = boxConfig.useCondoImages !== undefined ? boxConfig.useCondoImages !== false : isHero;
    const resolvedEnhanceImgs = boxConfig.showImagesToEnhance !== undefined ? boxConfig.showImagesToEnhance !== false : !isHero;
    const resolvedTabGroups = boxConfig.showTabGroupsPipelines !== undefined ? boxConfig.showTabGroupsPipelines !== false : !isHero;
    const resolvedPrompt = boxConfig.usePromptConfig !== false && boxConfig.showEnhancementPrompt !== false;

    setUseReferenceImage(resolvedRef);
    setReferenceImageData(boxConfig.referenceImage || '');
    setPromptSourceMode(
      boxConfig.promptSourceMode ||
      (propertyContext?.upstreamPrompts && propertyContext.upstreamPrompts.length > 0 ? 'upstream_ai' : 'preset')
    );
    setSelectedUpstreamAiId(boxConfig.selectedUpstreamAiId || propertyContext?.upstreamPrompts?.[0]?.id || '');
    setSelectedPresetId(boxConfig.browserPromptTemplateKey || (isHero ? 'fb_hero_master' : 'photo_retouch'));
    setCustomPrompt(boxConfig.browserCustomPrompt || boxConfig.customPrompt || '');
    setUsePromptConfig(resolvedPrompt);
    setShowEnhancementPrompt(resolvedPrompt);
    setUseCondoImages(resolvedCondo);
    setShowCondoProjectCard(boxConfig.showCondoProjectCard !== false);
    setShowImagesToEnhance(resolvedEnhanceImgs);
    setShowTabGroupsPipelines(resolvedTabGroups);
    setWorkerTabMode(boxConfig.workerTabMode || 'existing_tabs');
    setWorkerTabCount(boxConfig.workerTabCount || 4);
    setReuseSessionTabs(boxConfig.reuseSessionTabs !== false);
    setTargetFolder(
      boxConfig.targetFolder ||
      (boxConfig.id ? localStorage.getItem(`bolthaven_condo_target_folder_${boxConfig.id}`) : null) ||
      defaultBaseDir
    );
    setCondoSearchQuery(boxConfig.browserCondoName || propertyContext?.title || '');
  }, [boxConfig.id, isHero, isOpen]);

  // ── Sync Helper ───────────────────────────────────────────────────────────
  const updateSettings = (updates: Record<string, any>) => {
    onUpdateBoxConfig({
      ...boxConfig,
      ...updates,
    });
  };

  // ── Available Prompts Fallback ──────────────────────────────────────────
  const promptList = React.useMemo(() => {
    return availablePrompts && availablePrompts.length > 0 ? availablePrompts : loadAvailablePromptTemplates();
  }, [availablePrompts]);

  // ── Filtered Preset Options by Category (Generate Image vs Enhance Image) ──
  const filteredPresetOptions = React.useMemo(() => {
    if (isHero) {
      // Generate Image node (e.g. FB Hero)
      const libraryMatches = promptList
        .filter((p) => isGenerateCategory(p.category, p.name) && !['fb_hero_master', 'facebook_hero', 'marketplace_hero', 'tiktok_hero'].includes(String(p.id)))
        .map((p) => ({
          label: p.name,
          value: String(p.id),
        }));

      return [
        { label: '✨ FB Hero Prompt Template', value: 'fb_hero_master' },
        { label: '📸 Facebook Hero Master (HDR 4:5)', value: 'facebook_hero' },
        { label: '🛍️ Marketplace Hero (High Clarity)', value: 'marketplace_hero' },
        { label: '📱 TikTok Vertical Hero (9:16 / 4:5)', value: 'tiktok_hero' },
        ...libraryMatches,
      ];
    } else {
      // Enhance Image node (e.g. Enhance IMG / worker tab group)
      const libraryMatches = promptList
        .filter((p) => isEnhanceCategory(p.category, p.name) && !['photo_retouch', 'architectural_lighting', 'sky_sunlight_hdr', 'perspective_correction'].includes(String(p.id)))
        .map((p) => ({
          label: p.name,
          value: String(p.id),
        }));

      return [
        { label: '✨ Enhance Image (Default)', value: 'photo_retouch' },
        { label: '💎 Luxury Architectural Lighting', value: 'architectural_lighting' },
        { label: '🌤️ Natural Sky & Sunlight HDR', value: 'sky_sunlight_hdr' },
        { label: '📐 Perspective & Geometry Alignment', value: 'perspective_correction' },
        ...libraryMatches,
      ];
    }
  }, [isHero, promptList]);

  // ── Effective Preset ID within Current Category ──────────────────────────
  const effectivePresetId = React.useMemo(() => {
    if (filteredPresetOptions.some((o) => o.value === selectedPresetId)) {
      return selectedPresetId;
    }
    return filteredPresetOptions[0]?.value || (isHero ? 'fb_hero_master' : 'photo_retouch');
  }, [filteredPresetOptions, selectedPresetId, isHero]);

  // ── Effective Upstream AI Prompts (e.g. FB Hero Prompt) ────────────────────
  const effectiveUpstreamPrompts = React.useMemo(() => {
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

  // ── Resolve Active Prompt ─────────────────────────────────────────────────
  const activePromptText = React.useMemo(() => {
    if (promptSourceMode === 'upstream_ai') {
      const match = effectiveUpstreamPrompts.find((p) => p.id === selectedUpstreamAiId) || effectiveUpstreamPrompts[0];
      if (match?.text) return match.text;
      return (
        boxConfig.resolvedPrompt ||
        boxConfig.browserPromptText ||
        'Upstream AI Node prompt will be injected dynamically upon run.'
      );
    }
    if (promptSourceMode === 'custom') {
      return customPrompt || 'Enter custom image generation instructions...';
    }
    const preset = promptList.find(
      (p) => String(p.id) === effectivePresetId || p.name.toLowerCase() === effectivePresetId.toLowerCase()
    );
    return (preset as any)?.instructions || preset?.templateText || boxConfig.resolvedPrompt || 'Professional architectural condo enhancement prompt';
  }, [promptSourceMode, selectedUpstreamAiId, effectivePresetId, customPrompt, effectiveUpstreamPrompts, boxConfig, promptList]);

  // ── Scan Condo Directory from Target Folder ───────────────────────────────
  const scanCondoDirectory = async (q?: string, folder?: string) => {
    const query = q !== undefined ? q : condoSearchQuery;
    const baseDir = folder !== undefined ? folder : targetFolder;
    if (!query) return;

    setIsScanningFolder(true);
    try {
      const resp = await fetch(
        `http://127.0.0.1:9224/condo-images?condo_name=${encodeURIComponent(query)}&base_dir=${encodeURIComponent(baseDir)}`
      );
      const data = await resp.json();
      if (data && data.status === 'success') {
        setMatchedCondoInfo(data);
        updateSettings({
          browserCondoName: query,
          targetFolder: baseDir,
          browserMatchedFolder: data.matched_folder,
          browserCondoImagesCount: data.images_found,
        });
      } else {
        setMatchedCondoInfo(null);
      }
    } catch (e) {
      console.warn('Error querying condo images from companion:', e);
      setMatchedCondoInfo(null);
    } finally {
      setIsScanningFolder(false);
    }
  };

  // ── Scan Total Folders in Target Directory ────────────────────────────────
  const scanTotalFolders = async (dir: string) => {
    try {
      const resp = await fetch(`http://127.0.0.1:9224/scan-condos?base_dir=${encodeURIComponent(dir)}`);
      const data = await resp.json();
      if (data && data.status === 'success') {
        setTotalIndexedCondos(data.total_condos || 0);
      }
    } catch (e) {}
  };

  // Initial Scan
  useEffect(() => {
    if (targetFolder) {
      scanTotalFolders(targetFolder);
    }
    const q = boxConfig.browserCondoName || propertyContext?.title;
    if (q) {
      setCondoSearchQuery(q);
      scanCondoDirectory(q, targetFolder);
    }
  }, [propertyContext?.title, targetFolder]);

  // ── Native macOS Folder Chooser ───────────────────────────────────────────
  const handleChooseFolder = async () => {
    setIsChoosingFolder(true);
    try {
      const resp = await fetch('http://127.0.0.1:9224/choose-folder', { method: 'POST' });
      const data = await resp.json();
      if (data && data.status === 'success' && data.selected_path) {
        setTargetFolder(data.selected_path);
        if (boxConfig.id) {
          localStorage.setItem(`bolthaven_condo_target_folder_${boxConfig.id}`, data.selected_path);
        }
        updateSettings({ targetFolder: data.selected_path });
        scanTotalFolders(data.selected_path);
        if (condoSearchQuery) {
          scanCondoDirectory(condoSearchQuery, data.selected_path);
        }
      }
    } catch (e) {
      console.warn('Failed to choose folder via companion:', e);
    } finally {
      setIsChoosingFolder(false);
    }
  };

  // ── File Handlers for Reference Image ──────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setReferenceImageData(dataUrl);
      updateSettings({ referenceImage: dataUrl, useReferenceImage: true });
    };
    reader.readAsDataURL(file);
  };

  const handleCopyPrompt = () => {
    if (!activePromptText) return;
    navigator.clipboard.writeText(activePromptText);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  // Apple HIG Segmented Control Styles
  const appleTrackStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px',
    borderRadius: '8px',
    backgroundColor: isDark ? 'rgba(118, 118, 128, 0.24)' : 'rgba(118, 118, 128, 0.12)',
    border: isDark ? '0.5px solid rgba(255, 255, 255, 0.08)' : '0.5px solid rgba(0, 0, 0, 0.08)',
    boxShadow: isDark ? 'inset 0 1px 2px rgba(0, 0, 0, 0.35)' : 'inset 0 1px 2px rgba(0, 0, 0, 0.06)',
    gap: '2px',
  };

  const getAppleSegmentStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '3px 10px',
    borderRadius: '6px',
    border: 'none',
    fontSize: '0.625rem',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", Roboto, sans-serif',
    fontWeight: isActive ? 600 : 500,
    letterSpacing: '-0.01em',
    cursor: 'pointer',
    background: isActive
      ? (isDark
          ? 'linear-gradient(180deg, #1C8BFF 0%, #0071E3 100%)'
          : 'linear-gradient(180deg, #0077ED 0%, #0066CC 100%)')
      : 'transparent',
    color: isActive
      ? '#FFFFFF'
      : (isDark ? 'rgba(255, 255, 255, 0.72)' : 'rgba(0, 0, 0, 0.65)'),
    boxShadow: isActive
      ? (isDark
          ? '0 1px 3px rgba(0, 0, 0, 0.4), inset 0 0.5px 0.5px rgba(255, 255, 255, 0.4)'
          : '0 1px 2px rgba(0, 102, 204, 0.25), inset 0 0.5px 0.5px rgba(255, 255, 255, 0.45)')
      : 'none',
    textShadow: isActive ? '0 0.5px 1px rgba(0, 0, 0, 0.25)' : 'none',
    transition: 'all 0.16s cubic-bezier(0.16, 1, 0.3, 1)',
    whiteSpace: 'nowrap',
    outline: 'none',
    userSelect: 'none',
  });

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        bottom: 0,
        right: '380px', // sits smoothly right alongside the 380px main sidebar inspector
        width: '420px',
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
      {/* ── Top Header ────────────────────────────────────────────────────────── */}
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
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FiSliders size={15} />
          </div>
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              {boxConfig.title || boxConfig.browserGroupName || 'Node'} Settings
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Configure visible inspector modules for this node
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          title="Close Settings Sidebox"
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

      {/* ── Scrollable Body ───────────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        {/* ── 1. Condo / Project Name (Hero Only) ── */}
        {isHero && (
          <>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
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
                    <FiFolder size={14} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      1. Condo / Project Name
                    </div>
                    <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                      From FB Hero Prompt / Active Project
                    </div>
                  </div>
                </div>

                <ToggleSwitch
                  checked={showCondoProjectCard}
                  onChange={(val) => {
                    setShowCondoProjectCard(val);
                    updateSettings({ showCondoProjectCard: val });
                  }}
                  size="sm"
                  activeColor="#3B82F6"
                />
              </div>

              <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                Display the property context header card in the inspector.
              </div>

              {showCondoProjectCard && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#F1F5F9',
                    border: '1px solid var(--border-color)',
                    marginTop: '2px',
                  }}
                >
                  <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>Current Context:</span>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {boxConfig.browserCondoName || propertyContext?.title || 'Featured Property Listing'}
                  </span>
                </div>
              )}
            </div>

            {/* ── 2. Reference Image ── */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
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
                      2. Reference Image
                    </div>
                    <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                      Layout example pasted into Tab 2
                    </div>
                  </div>
                </div>

                <ToggleSwitch
                  checked={useReferenceImage}
                  onChange={(val) => {
                    setUseReferenceImage(val);
                    updateSettings({ useReferenceImage: val });
                  }}
                  size="sm"
                  activeColor="#3B82F6"
                />
              </div>

              <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                Enable custom layout or style reference photo for ChatGPT image generation in Tab 2.
              </div>

              {useReferenceImage && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#F1F5F9',
                    border: '1px solid var(--border-color)',
                    marginTop: '2px',
                  }}
                >
                  {referenceImageData ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <img
                          src={referenceImageData}
                          alt="Ref preview"
                          style={{ width: '32px', height: '32px', borderRadius: '4px', objectFit: 'cover' }}
                        />
                        <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#10B981' }}>
                          ● Photo Attached
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <label
                          style={{
                            fontSize: '0.625rem',
                            fontWeight: 600,
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
                          }}
                        >
                          Change
                          <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setReferenceImageData('');
                            updateSettings({ referenceImage: '' });
                          }}
                          style={{
                            fontSize: '0.625rem',
                            fontWeight: 600,
                            color: '#EF4444',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>No reference photo attached</span>
                      <label
                        style={{
                          fontSize: '0.625rem',
                          fontWeight: 600,
                          color: '#EC4899',
                          cursor: 'pointer',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(236, 72, 153, 0.12)',
                        }}
                      >
                        Browse...
                        <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── 3. Condo Photos (1, 2, 3) ── */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
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
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      3. Condo Photos (1, 2, 3)
                    </div>
                    <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                      Target: Condo Building
                    </div>
                  </div>
                </div>

                <ToggleSwitch
                  checked={useCondoImages}
                  onChange={(val) => {
                    setUseCondoImages(val);
                    updateSettings({ useCondoImages: val });
                  }}
                  size="sm"
                  activeColor="#3B82F6"
                />
              </div>

              <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                Automatically find and attach condo photos #1, #2, and #3 from your local target directory.
              </div>

              {useCondoImages && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '4px', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    Target Folder for Condo Subfolders:
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="text"
                      value={targetFolder}
                      onChange={(e) => {
                        setTargetFolder(e.target.value);
                        if (boxConfig.id) {
                          localStorage.setItem(`bolthaven_condo_target_folder_${boxConfig.id}`, e.target.value);
                        }
                        updateSettings({ targetFolder: e.target.value });
                      }}
                      placeholder="/Users/.../Desktop/Condo Building"
                      style={{
                        flex: 1,
                        fontSize: '0.6875rem',
                        padding: '5px 8px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#F8FAFC',
                        color: 'var(--text-primary)',
                      }}
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handleChooseFolder}
                      disabled={isChoosingFolder}
                      style={{ fontSize: '0.625rem', padding: '4px 9px', whiteSpace: 'nowrap' }}
                    >
                      {isChoosingFolder ? 'Choosing...' : 'Browse...'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Image(s) to Enhance ── */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
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
                <FiImage size={14} />
              </div>
              <div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {isHero ? '4. Image(s) to Enhance' : '1. Image(s) to Enhance'}
                </div>
                <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                  Target: Tab Group worker photos
                </div>
              </div>
            </div>

            <ToggleSwitch
              checked={showImagesToEnhance}
              onChange={(val) => {
                setShowImagesToEnhance(val);
                updateSettings({ showImagesToEnhance: val });
              }}
              size="sm"
              activeColor="#3B82F6"
            />
          </div>

          <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
            Display photo selection from &ldquo;Get Images&rdquo; or upstream canvas connections.
          </div>
        </div>

        {/* ── Prompt Configuration ── */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
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
                  {isHero ? '5. Prompt Configuration' : '2. Enhancement Prompt'}
                </div>
                <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                  Template preset & instructions
                </div>
              </div>
            </div>

            <ToggleSwitch
              checked={usePromptConfig}
              onChange={(val) => {
                setUsePromptConfig(val);
                setShowEnhancementPrompt(val);
                updateSettings({ usePromptConfig: val, showEnhancementPrompt: val });
              }}
              size="sm"
              activeColor="#3B82F6"
            />
          </div>

          <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
            {isHero
              ? 'Configure prompt template, 2-Stage browser automation flow, or custom instructions.'
              : 'Configure enhancement prompt template or custom prompt applied across worker tabs.'}
          </div>

          {usePromptConfig && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                marginTop: '4px',
                paddingTop: '8px',
                borderTop: '1px solid var(--border-color)',
              }}
            >
              {/* 2-Tab Staging Flow Mode: ONLY shown for Hero / Generate Image nodes */}
              {isHero && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    Staging Flow Mode:
                  </span>
                  <div style={appleTrackStyle}>
                    <button
                      type="button"
                      onClick={() => {
                        setStagingMode('direct_tab2');
                        updateSettings({ stagingMode: 'direct_tab2', skipTab1: true });
                      }}
                      style={getAppleSegmentStyle(stagingMode === 'direct_tab2')}
                    >
                      Direct (Skip Tab 1)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStagingMode('two_stage_tabs');
                        updateSettings({ stagingMode: 'two_stage_tabs', skipTab1: false });
                      }}
                      style={getAppleSegmentStyle(stagingMode !== 'direct_tab2')}
                    >
                      2-Stage Browser
                    </button>
                  </div>
                </div>
              )}

                  {/* Prompt Type Selection */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Prompt Type:
                      </span>
                      <div style={appleTrackStyle}>
                        <button
                          type="button"
                          onClick={() => {
                            setPromptSourceMode('preset');
                            updateSettings({ promptSourceMode: 'preset' });
                          }}
                          style={getAppleSegmentStyle(promptSourceMode === 'preset')}
                        >
                          Prompt Template
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPromptSourceMode('upstream_ai');
                            updateSettings({
                              promptSourceMode: 'upstream_ai',
                              selectedUpstreamAiId: selectedUpstreamAiId || effectiveUpstreamPrompts[0]?.id,
                            });
                          }}
                          style={getAppleSegmentStyle(promptSourceMode === 'upstream_ai')}
                        >
                          AI Generate
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPromptSourceMode('custom');
                            updateSettings({ promptSourceMode: 'custom' });
                          }}
                          style={getAppleSegmentStyle(promptSourceMode === 'custom')}
                        >
                          Custom
                        </button>
                      </div>
                    </div>

                    <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', lineHeight: 1.35 }}>
                      {promptSourceMode === 'preset'
                        ? 'Uses a curated prompt template preset from library (e.g. FB Hero Prompt Template).'
                        : promptSourceMode === 'upstream_ai'
                        ? 'Gets prompt dynamically from upstream AI model (e.g. FB Hero Prompt) on canvas.'
                        : 'Uses custom manual instructions entered below.'}
                    </div>

                    {/* 1. Prompt Template Option */}
                    {promptSourceMode === 'preset' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
                        <span style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                          Select Prompt Template:
                        </span>
                        <Select
                          value={effectivePresetId}
                          onChange={(val) => {
                            setSelectedPresetId(val);
                            const chosen = promptList.find((p) => String(p.id) === val || p.name === val);
                            updateSettings({
                              browserPromptTemplateKey: val,
                              browserPromptTemplateId: chosen?.id,
                              browserPromptText: (chosen as any)?.instructions || chosen?.templateText,
                            });
                          }}
                          options={filteredPresetOptions}
                        />
                        {activePromptText && (
                          <div
                            style={{
                              marginTop: '2px',
                              padding: '6px 8px',
                              borderRadius: '6px',
                              backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#F8FAFC',
                              border: '1px solid var(--border-color)',
                              fontSize: '0.625rem',
                              color: 'var(--text-secondary)',
                              maxHeight: '68px',
                              overflowY: 'auto',
                              whiteSpace: 'pre-wrap',
                              lineHeight: 1.4,
                            }}
                          >
                            {activePromptText}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 2. AI Generate (Upstream AI Model) Option */}
                    {promptSourceMode === 'upstream_ai' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
                        <span style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                          Select AI Generator Node (Canvas):
                        </span>
                        <Select
                          value={selectedUpstreamAiId || effectiveUpstreamPrompts[0]?.id}
                          onChange={(val) => {
                            setSelectedUpstreamAiId(val);
                            updateSettings({ selectedUpstreamAiId: val });
                          }}
                          options={effectiveUpstreamPrompts.map((p) => ({
                            label: `🤖 ${p.title} (AI Model)`,
                            value: p.id,
                          }))}
                        />
                        <div
                          style={{
                            marginTop: '2px',
                            padding: '6px 8px',
                            borderRadius: '6px',
                            backgroundColor: isDark ? 'rgba(59, 130, 246, 0.08)' : 'rgba(59, 130, 246, 0.05)',
                            border: '1px solid rgba(59, 130, 246, 0.25)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981' }} />
                            <span style={{ fontSize: '0.625rem', fontWeight: 600, color: '#3B82F6' }}>
                              Linked AI Node: {effectiveUpstreamPrompts.find((p) => p.id === (selectedUpstreamAiId || effectiveUpstreamPrompts[0]?.id))?.title || 'FB Hero Prompt'}
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: '0.625rem',
                              color: 'var(--text-secondary)',
                              maxHeight: '68px',
                              overflowY: 'auto',
                              whiteSpace: 'pre-wrap',
                              lineHeight: 1.4,
                            }}
                          >
                            {activePromptText}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 3. Custom Prompt Option */}
                    {promptSourceMode === 'custom' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
                        <span style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                          Custom Instructions:
                        </span>
                        <textarea
                          rows={3}
                          value={customPrompt}
                          onChange={(e) => {
                            setCustomPrompt(e.target.value);
                            updateSettings({ browserCustomPrompt: e.target.value, customPrompt: e.target.value });
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
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── 6. Tab Groups & Pipelines ── */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
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
                      backgroundColor: 'rgba(139, 92, 246, 0.12)',
                      color: '#8B5CF6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <FiLayers size={14} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {isHero ? '6. Tab Groups & Pipelines' : '3. Tab Groups & Pipelines'}
                    </div>
                    <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                      Multi-tab browser group orchestration
                    </div>
                  </div>
                </div>

                <ToggleSwitch
                  checked={showTabGroupsPipelines}
                  onChange={(val) => {
                    setShowTabGroupsPipelines(val);
                    updateSettings({ showTabGroupsPipelines: val });
                  }}
                  size="sm"
                  activeColor="#3B82F6"
                />
              </div>

              <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                Display multi-pipeline Chrome tab workers and live group execution controls.
              </div>

              {showTabGroupsPipelines && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginTop: '4px' }}>
                  {/* Target Group Row */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#F1F5F9',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>Target Group:</span>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {boxConfig.browserGroupName || boxConfig.title || 'Enhance IMG'}
                    </span>
                  </div>

                  {/* Worker Tab Mode (Existing Group Tabs vs Fresh New Tabs) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <div style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                      Worker Tabs Source:
                    </div>
                    <div style={{ ...appleTrackStyle, display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setWorkerTabMode('existing_tabs');
                          updateSettings({ workerTabMode: 'existing_tabs' });
                        }}
                        style={{ ...getAppleSegmentStyle(workerTabMode === 'existing_tabs'), textAlign: 'center', justifyContent: 'center' }}
                      >
                        Existing Group Tabs
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setWorkerTabMode('new_tabs');
                          updateSettings({ workerTabMode: 'new_tabs' });
                        }}
                        style={{ ...getAppleSegmentStyle(workerTabMode === 'new_tabs'), textAlign: 'center', justifyContent: 'center' }}
                      >
                        Open Fresh Tabs
                      </button>
                    </div>
                    <div style={{ fontSize: '0.5625rem', color: 'var(--text-muted)', paddingLeft: '2px' }}>
                      {workerTabMode === 'existing_tabs'
                        ? 'Uses pre-configured conversation worker URLs.'
                        : 'Opens clean ChatGPT tabs without past chat history and remembers them.'}
                    </div>
                  </div>

                  {/* Worker Tab Count Selector (1, 2, 3, 4) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                        Parallel Workers:
                      </span>
                      <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#3B82F6' }}>
                        {workerTabCount} {workerTabCount === 1 ? 'Tab Worker' : 'Tabs Concurrent'}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                      {[1, 2, 3, 4].map((count) => {
                        const isSelected = workerTabCount === count;
                        return (
                          <button
                            key={count}
                            type="button"
                            onClick={() => {
                              setWorkerTabCount(count);
                              updateSettings({ workerTabCount: count });
                            }}
                            style={{
                              padding: '5px 0',
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              borderRadius: '6px',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              border: isSelected ? '1px solid #3B82F6' : '1px solid var(--border-color)',
                              backgroundColor: isSelected ? '#3B82F6' : (isDark ? 'rgba(0,0,0,0.15)' : '#FFFFFF'),
                              color: isSelected ? '#FFFFFF' : 'var(--text-primary)',
                            }}
                          >
                            {count} {count === 1 ? 'tab' : 'tabs'}
                          </button>
                        );
                      })}
                    </div>
                    <div style={{ fontSize: '0.5625rem', color: 'var(--text-muted)', paddingLeft: '2px' }}>
                      {workerTabCount === 1
                        ? '1 photo processed sequentially (safest from rate limits).'
                        : `${workerTabCount} photos processed simultaneously in parallel (${workerTabCount}x speed).`}
                    </div>
                  </div>

                  {/* Session Re-use Toggle */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      backgroundColor: isDark ? 'rgba(0,0,0,0.15)' : '#F8FAFC',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Reuse Tabs on Next Run
                      </div>
                      <div style={{ fontSize: '0.5625rem', color: 'var(--text-muted)' }}>
                        Re-running targets previously opened tabs without opening new ones
                      </div>
                    </div>

                    <ToggleSwitch
                      checked={reuseSessionTabs}
                      onChange={(val) => {
                        setReuseSessionTabs(val);
                        updateSettings({ reuseSessionTabs: val });
                      }}
                      size="sm"
                      activeColor="#10B981"
                    />
                  </div>
                </div>
              )}
            </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <div
        style={{
          padding: '0.75rem 1.125rem',
          borderTop: 'none',
          backgroundColor: isDark ? 'var(--bg-main)' : '#FFFFFF',
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <Button size="sm" variant="primary" onClick={onClose} style={{ fontSize: '0.75rem', fontWeight: 600 }}>
          Done & Apply Settings
        </Button>
      </div>
    </div>
  );
};
