import React, { useState, useMemo, useEffect } from 'react';
import {
  FiX,
  FiSliders,
  FiEdit2,
  FiCheck,
  FiImage,
  FiCheckCircle,
  FiLayers,
  FiFolder,
  FiFolderPlus,
} from 'react-icons/fi';
import {
  type CropStudioFormat,
  getSavedCropFormats,
  fetchCropFormatsFromBackend,
  renameCropFormat,
  syncCropFormatToWorkflowConfig,
} from '../watermark/cropFormats';
import type { DynamicAIBoxConfig, WorkflowWireConnection } from './FacebookWorkflowCanvas';
import { Select, type SelectOption } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';

export interface PhotoCropSettingsSideboxProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  box: DynamicAIBoxConfig;
  onUpdateBox: (id: string, updates: Partial<DynamicAIBoxConfig>) => void;
  images?: any[];
  workflowBoxes?: DynamicAIBoxConfig[];
  connections?: WorkflowWireConnection[];
  enhancedPhotos?: Record<number, string>;
  watermarkedPhotos?: Record<number, string>;
  listingCode?: string;
  heroImage?: { url: string; fileName?: string; condoName?: string };
}

export const PhotoCropSettingsSidebox: React.FC<PhotoCropSettingsSideboxProps> = ({
  isOpen,
  onClose,
  isDark,
  box,
  onUpdateBox,
  images = [],
  workflowBoxes = [],
  connections = [],
  enhancedPhotos = {},
  watermarkedPhotos = {},
  listingCode: _listingCode,
  heroImage,
}) => {
  const [savedFormats, setSavedFormats] = useState<CropStudioFormat[]>(() => getSavedCropFormats());

  useEffect(() => {
    const handleSync = () => {
      setSavedFormats(getSavedCropFormats());
    };
    fetchCropFormatsFromBackend()
      .then((fmts) => {
        if (fmts && fmts.length > 0) setSavedFormats(fmts);
      })
      .catch(() => {});
    window.addEventListener('storage', handleSync);
    window.addEventListener('ea_crop_formats_updated', handleSync);
    window.addEventListener('ea_active_crop_format_changed', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('ea_crop_formats_updated', handleSync);
      window.removeEventListener('ea_active_crop_format_changed', handleSync);
    };
  }, []);

  const [selectedFormatId, setSelectedFormatId] = useState<string>(() => {
    return (
      box.cropFormatId ||
      savedFormats.find((f) => f.id === box.templateId)?.id ||
      savedFormats.find((f) => box.templateText && f.name.toLowerCase() === box.templateText.toLowerCase())?.id ||
      savedFormats.find((f) => box.title && f.name && box.title.toLowerCase().includes(f.name.toLowerCase()))?.id ||
      ((box.title?.toLowerCase().includes('fb') || box.templateText?.toLowerCase().includes('fb'))
        ? savedFormats.find((f) => f.name.toLowerCase().includes('fb'))?.id
        : null) ||
      savedFormats.find((f) => f.isDefault)?.id ||
      savedFormats[0]?.id ||
      'format-1792362113668'
    );
  });

  const [nodeTitle, setNodeTitle] = useState<string>(() => (box.title || 'Crop & Cut').replace(/^Format:\s*/i, ''));
  const [isEditingFormatName, setIsEditingFormatName] = useState(false);
  const [formatNameInput, setFormatNameInput] = useState('');
  const [downloadFolder, setDownloadFolder] = useState<string>(() => {
    return box.downloadFolder || localStorage.getItem('ea_crop_download_folder') || '/Downloads';
  });

  useEffect(() => {
    const formatId =
      box.cropFormatId ||
      savedFormats.find((f) => f.id === box.templateId)?.id ||
      savedFormats.find((f) => box.templateText && f.name.toLowerCase() === box.templateText.toLowerCase())?.id ||
      savedFormats.find((f) => box.title && f.name && box.title.toLowerCase().includes(f.name.toLowerCase()))?.id ||
      ((box.title?.toLowerCase().includes('fb') || box.templateText?.toLowerCase().includes('fb'))
        ? savedFormats.find((f) => f.name.toLowerCase().includes('fb'))?.id
        : null) ||
      savedFormats.find((f) => f.isDefault)?.id ||
      savedFormats[0]?.id ||
      'format-1792362113668';
    setSelectedFormatId(formatId);
    setNodeTitle((box.title || 'Crop & Cut').replace(/^Format:\s*/i, ''));
  }, [box.id, box.cropFormatId, box.title, box.templateId, box.templateText]);

  // Image source: 'get_images' | 'enhance' | 'generate' | 'all'
  const [imageSource, setImageSource] = useState<'get_images' | 'enhance' | 'generate' | 'all'>(
    (box.imageSource as any) || 'get_images'
  );

  useEffect(() => {
    if (box.imageSource && box.imageSource !== imageSource) {
      setImageSource(box.imageSource as any);
    }
  }, [box.imageSource]);

  // Resolve generator / hero node title
  const heroNode = useMemo(() => {
    return workflowBoxes.find(
      (b) =>
        b.title?.toLowerCase().includes('hero') ||
        b.browserGroupName?.toLowerCase().includes('hero') ||
        b.tabGroupMode === 'generate' ||
        b.processKind === 'generate_image'
    );
  }, [workflowBoxes]);

  const heroLabel = useMemo(() => {
    if (heroNode) {
      return (heroNode.browserGroupName || heroNode.title || 'FB Hero').trim();
    }
    return 'FB Hero';
  }, [heroNode]);

  // Resolve enhance node title
  const enhanceNode = useMemo(() => {
    return workflowBoxes.find(
      (b) =>
        (b.title?.toLowerCase().includes('enhance') ||
          b.browserGroupName?.toLowerCase().includes('enhance') ||
          b.tabGroupMode === 'enhance') &&
        b.id !== box.id
    );
  }, [workflowBoxes, box.id]);

  const enhanceLabel = useMemo(() => {
    if (enhanceNode) {
      return (enhanceNode.browserGroupName || enhanceNode.title || 'Enhance Image').trim();
    }
    return 'Enhance Image';
  }, [enhanceNode]);

  const effectiveHeroImage = useMemo(() => {
    if (heroImage && heroImage.url) return heroImage;
    try {
      const saved = localStorage.getItem('bolthaven_last_hero_image');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    if (box.referenceImage) {
      return { url: box.referenceImage, fileName: 'hero_reference.png' };
    }
    if (images.length > 0) {
      const first = images[0];
      const url = first.stored_url || first.source_url;
      if (url) return { url, fileName: 'hero_sample.png' };
    }
    return null;
  }, [heroImage, box.referenceImage, images]);

  // Source list calculation
  const currentSourceList = useMemo(() => {
    const rawList: Array<{
      id: string;
      index: number;
      displayNumber: number;
      url: string;
      source: 'get_images' | 'enhance' | 'generate';
      label: string;
      isEnhanced?: boolean;
    }> = [];

    if (imageSource === 'get_images' || imageSource === 'all') {
      images.forEach((img, idx) => {
        const photoNum = idx + 1;
        const url =
          watermarkedPhotos?.[idx] ||
          (typeof img.index === 'number' ? watermarkedPhotos?.[img.index] : undefined) ||
          (img.stored_url
            ? (img.stored_url.startsWith('http') ? img.stored_url : `http://localhost:8085${img.stored_url}`)
            : img.source_url);
        rawList.push({
          id: `raw-${photoNum}`,
          index: photoNum,
          displayNumber: photoNum,
          url,
          source: 'get_images',
          label: `Photo #${photoNum}`,
        });
      });
    }

    if (imageSource === 'enhance' || imageSource === 'all') {
      const hasEnhanced = Object.keys(enhancedPhotos).length > 0;
      if (imageSource === 'enhance') {
        images.forEach((img, idx) => {
          const photoNum = idx + 1;
          const enhUrl = enhancedPhotos[idx];
          const fallbackUrl = img.stored_url
            ? (img.stored_url.startsWith('http') ? img.stored_url : `http://localhost:8085${img.stored_url}`)
            : img.source_url;
          rawList.push({
            id: `enh-${photoNum}`,
            index: photoNum,
            displayNumber: photoNum,
            url: enhUrl || fallbackUrl,
            source: 'enhance',
            label: enhUrl ? `Enhanced #${photoNum}` : `Photo #${photoNum}`,
            isEnhanced: Boolean(enhUrl),
          });
        });
      }
    }

    if (imageSource === 'generate' || imageSource === 'all') {
      if (effectiveHeroImage && effectiveHeroImage.url) {
        rawList.push({
          id: 'hero-1',
          index: imageSource === 'generate' ? 1 : 999,
          displayNumber: 1,
          url: effectiveHeroImage.url,
          source: 'generate',
          label: effectiveHeroImage.condoName ? `${effectiveHeroImage.condoName} Hero` : `${heroLabel} (1 Photo)`,
        });
      }
    }

    return rawList;
  }, [imageSource, images, enhancedPhotos, effectiveHeroImage, heroLabel, watermarkedPhotos]);

  const [selectedIndices, setSelectedIndices] = useState<number[]>(() => {
    if (Array.isArray(box.selectedImageIndices) && box.selectedImageIndices.length > 0) {
      return box.selectedImageIndices;
    }
    return [];
  });

  useEffect(() => {
    if (currentSourceList.length > 0 && selectedIndices.length === 0) {
      const all = currentSourceList.map((p) => p.index);
      setSelectedIndices(all);
      onUpdateBox(box.id, { selectedImageIndices: all });
    }
  }, [currentSourceList.length]);

  const activePhotosToFormat = useMemo(() => {
    const list = currentSourceList.filter((p) => selectedIndices.includes(p.index));
    return list.length > 0 ? list : currentSourceList;
  }, [currentSourceList, selectedIndices]);

  // Format dropdown options
  const formatOptions = useMemo<SelectOption[]>(() => {
    return savedFormats.map((f) => ({
      value: f.id,
      label: `${f.name} (${f.targetWidth}×${f.targetHeight} · ${f.aspect || '1:1'})`,
    }));
  }, [savedFormats]);

  const currentFormat = useMemo(() => {
    return (
      savedFormats.find((f) => f.id === selectedFormatId) ||
      savedFormats.find((f) => f.id === box.cropFormatId || f.id === box.templateId) ||
      savedFormats.find((f) => box.templateText && f.name.toLowerCase() === box.templateText.toLowerCase()) ||
      savedFormats.find((f) => box.title && f.name && box.title.toLowerCase().includes(f.name.toLowerCase())) ||
      savedFormats[0]
    );
  }, [savedFormats, selectedFormatId, box.cropFormatId, box.templateId, box.templateText, box.title]);

  const sourceOptions = useMemo<SelectOption[]>(() => {
    const opts: SelectOption[] = [];
    const hasIncomingHero = connections.some(
      (c) => c.toNodeId === box.id && (c.fromNodeId.includes('hero') || workflowBoxes.some((b) => b.id === c.fromNodeId && (b.title?.toLowerCase().includes('hero') || b.browserGroupName?.toLowerCase().includes('hero'))))
    );
    const hasIncomingEnhance = connections.some(
      (c) => c.toNodeId === box.id && (c.fromNodeId.includes('enhance') || workflowBoxes.some((b) => b.id === c.fromNodeId && (b.title?.toLowerCase().includes('enhance') || b.browserGroupName?.toLowerCase().includes('enhance'))))
    );

    if (hasIncomingHero || heroNode) {
      opts.push({
        value: 'generate',
        label: `${heroLabel} (1 Photo)`,
      });
    }
    if (hasIncomingEnhance || enhanceNode) {
      opts.push({
        value: 'enhance',
        label: `${enhanceLabel} (${images.length || 12} Photos)`,
      });
    }
    opts.push({
      value: 'get_images',
      label: `Get Images (${images.length || 12} Photos)`,
    });
    opts.push({
      value: 'all',
      label: 'All Available Media',
    });
    return opts;
  }, [connections, box.id, workflowBoxes, heroNode, enhanceNode, heroLabel, enhanceLabel, images.length]);

  const handleSelectFormat = (format: CropStudioFormat) => {
    setSelectedFormatId(format.id);
    const cleanTitle = format.name.replace(/^Format:\s*/i, '');
    setNodeTitle(cleanTitle);
    syncCropFormatToWorkflowConfig(format);
    onUpdateBox(box.id, {
      cropFormatId: format.id,
      templateId: format.id,
      templateText: format.name,
      title: cleanTitle,
    });
  };

  const handleSourceChange = (newSource: 'get_images' | 'enhance' | 'generate' | 'all') => {
    setImageSource(newSource);
    onUpdateBox(box.id, { imageSource: newSource });
  };

  const handleTitleChange = (val: string) => {
    setNodeTitle(val);
    onUpdateBox(box.id, { title: val, templateText: val });
  };

  const toggleSelectPhoto = (photoIndex: number) => {
    let next: number[];
    if (selectedIndices.includes(photoIndex)) {
      if (selectedIndices.length <= 1) return;
      next = selectedIndices.filter((i) => i !== photoIndex);
    } else {
      next = [...selectedIndices, photoIndex];
    }
    setSelectedIndices(next);
    onUpdateBox(box.id, {
      selectedImageIndices: next,
      isCustomPicked: true,
    } as any);
  };

  if (!isOpen) return null;

  return (
    <div
      className="workflow-sidebar"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: 0,
        bottom: 0,
        right: '380px', // sits smoothly alongside the 380px main sidebar inspector
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
              backgroundColor: 'var(--accent-primary-alpha, rgba(37, 99, 235, 0.1))',
              color: 'var(--accent-primary, #3B82F6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FiSliders size={15} />
          </div>
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              Photo Format & Crop Settings
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Configure crop format presets, dimensions, and photo sources
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          title="Close Settings"
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
            pointerEvents: 'auto',
            userSelect: 'none',
          }}
        >
          <FiX size={15} style={{ pointerEvents: 'none' }} />
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
          gap: '1rem',
        }}
      >
        {/* ── 1. Select Crop & Frame Format (User's 3rd Image) ──────────────────── */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            padding: '12px 14px',
            borderRadius: '10px',
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#F8FAFC',
            border: '1px solid var(--border-color)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Select Crop & Frame Format
            </label>
            <span
              style={{
                fontSize: '0.6875rem',
                padding: '2px 8px',
                borderRadius: '10px',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                color: 'var(--text-muted)',
                fontWeight: 500,
              }}
            >
              {savedFormats.length} presets
            </span>
          </div>

          <Select
            options={formatOptions}
            value={selectedFormatId}
            onChange={(val) => {
              const format = savedFormats.find((f) => f.id === val);
              if (format) handleSelectFormat(format);
            }}
            height="38px"
            placeholder="Select a crop & frame format..."
          />

          {/* Selected Format Summary Card */}
          {currentFormat && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: isDark ? 'var(--bg-surface)' : '#FFFFFF',
              }}
            >
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '4px 8px',
                  borderRadius: '6px',
                  backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  color: 'var(--accent-primary, #3B82F6)',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  flexShrink: 0,
                  minWidth: '40px',
                  textAlign: 'center',
                }}
              >
                {currentFormat.aspect || '1:1'}
              </span>

              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isEditingFormatName ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <input
                        type="text"
                        value={formatNameInput}
                        onChange={(e) => setFormatNameInput(e.target.value)}
                        onBlur={() => {
                          if (formatNameInput.trim()) {
                            renameCropFormat(currentFormat.id, formatNameInput.trim());
                            const cleanTitle = formatNameInput.trim().replace(/^Format:\s*/i, '');
                            setNodeTitle(cleanTitle);
                            onUpdateBox(box.id, { title: cleanTitle, templateText: cleanTitle });
                          }
                          setIsEditingFormatName(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (formatNameInput.trim()) {
                              renameCropFormat(currentFormat.id, formatNameInput.trim());
                              const cleanTitle = formatNameInput.trim().replace(/^Format:\s*/i, '');
                              setNodeTitle(cleanTitle);
                              onUpdateBox(box.id, { title: cleanTitle, templateText: cleanTitle });
                            }
                            setIsEditingFormatName(false);
                          }
                          if (e.key === 'Escape') setIsEditingFormatName(false);
                        }}
                        autoFocus
                        style={{
                          height: '24px',
                          padding: '0 6px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          borderRadius: '4px',
                          border: '1px solid var(--accent-primary)',
                          backgroundColor: 'var(--bg-main)',
                          color: 'var(--text-primary)',
                          outline: 'none',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (formatNameInput.trim()) {
                            renameCropFormat(currentFormat.id, formatNameInput.trim());
                            const cleanTitle = formatNameInput.trim().replace(/^Format:\s*/i, '');
                            setNodeTitle(cleanTitle);
                            onUpdateBox(box.id, { title: cleanTitle, templateText: cleanTitle });
                          }
                          setIsEditingFormatName(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '22px',
                          height: '22px',
                          borderRadius: '4px',
                          border: 'none',
                          backgroundColor: 'var(--accent-primary)',
                          color: '#FFFFFF',
                          cursor: 'pointer',
                        }}
                        title="Save name"
                      >
                        <FiCheck size={11} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {currentFormat.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setFormatNameInput(currentFormat.name);
                          setIsEditingFormatName(true);
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '18px',
                          height: '18px',
                          borderRadius: '3px',
                          border: 'none',
                          backgroundColor: 'transparent',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                        }}
                        title="Rename format"
                      >
                        <FiEdit2 size={11} />
                      </button>
                    </>
                  )}
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      color: 'var(--text-muted)',
                      fontWeight: 500,
                    }}
                  >
                    {currentFormat.targetWidth} × {currentFormat.targetHeight} px
                  </span>
                </div>

                {currentFormat.description && (
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      color: 'var(--text-muted)',
                      marginTop: '2px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {currentFormat.description.split('•')[1]?.trim() || currentFormat.description}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Node Label input */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              borderRadius: '6px',
              backgroundColor: isDark ? 'var(--bg-surface)' : '#FFFFFF',
              border: '1px solid var(--border-color)',
            }}
          >
            <FiEdit2 size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500, flexShrink: 0 }}>
              Node Label:
            </span>
            <input
              type="text"
              value={nodeTitle}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="e.g. FB Hero Cut, Instagram Portrait"
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                fontSize: '0.75rem',
                color: 'var(--text-primary)',
                outline: 'none',
                padding: 0,
                fontWeight: 500,
              }}
            />
          </div>
        </div>

        {/* ── 2. Target Image(s) to Crop (User's 2nd Image) ────────────────────── */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            padding: '12px 14px',
            borderRadius: '10px',
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#F8FAFC',
            border: '1px solid var(--border-color)',
          }}
        >
          {/* Header with counter */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '6px',
                  backgroundColor: '#8B5CF6',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <FiImage size={13} />
              </div>
              <div>
                <div style={{ fontSize: '0.78125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Target Image(s) to Crop
                </div>
                <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                  Select source and photos to cut
                </div>
              </div>
            </div>

            <span
              style={{
                fontSize: '0.625rem',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '10px',
                backgroundColor: box.enabled === false
                  ? (isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9')
                  : (activePhotosToFormat.length > 0 ? 'rgba(16, 185, 129, 0.12)' : isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9'),
                color: box.enabled === false
                  ? 'var(--text-muted)'
                  : (activePhotosToFormat.length > 0 ? '#10B981' : 'var(--text-secondary)'),
                border: box.enabled === false
                  ? '1px solid var(--border-color)'
                  : (activePhotosToFormat.length > 0 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-color)'),
              }}
            >
              {box.enabled === false
                ? `⏸️ 0 of ${currentSourceList.length} (Bypassed)`
                : `✓ ${activePhotosToFormat.length} of ${currentSourceList.length} Selected`}
            </span>
          </div>

          {/* 1. Image Source Dropdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Choose Image Source
            </label>
            <Select
              options={sourceOptions}
              value={imageSource}
              onChange={(val) => handleSourceChange(val as any)}
              height="36px"
              placeholder="Select image source..."
            />
          </div>

          {/* Photo Selection Grid if multiple available */}
          {currentSourceList.length > 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Active Photos to Process:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const all = currentSourceList.map((p) => p.index);
                    const isAll = selectedIndices.length === all.length;
                    const next = isAll ? [currentSourceList[0].index] : all;
                    setSelectedIndices(next);
                    onUpdateBox(box.id, { selectedImageIndices: next });
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-primary, #3B82F6)',
                    fontSize: '0.625rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  {selectedIndices.length === currentSourceList.length ? 'Deselect Extra' : 'Select All'}
                </button>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '6px',
                  maxHeight: '140px',
                  overflowY: 'auto',
                  padding: '2px',
                }}
              >
                {currentSourceList.map((photo) => {
                  const isSelected = selectedIndices.includes(photo.index);
                  return (
                    <div
                      key={photo.id}
                      onClick={() => toggleSelectPhoto(photo.index)}
                      title={`${photo.label} — click to toggle`}
                      style={{
                        position: 'relative',
                        height: '56px',
                        borderRadius: '6px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        border: isSelected
                          ? '2px solid var(--accent-primary, #3B82F6)'
                          : '1px solid var(--border-color)',
                        opacity: isSelected ? 1 : 0.45,
                        backgroundColor: '#000000',
                      }}
                    >
                      <img
                        src={photo.url}
                        alt={photo.label}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          padding: '1px 3px',
                          background: 'rgba(0,0,0,0.65)',
                          fontSize: '0.5rem',
                          color: '#FFFFFF',
                          textAlign: 'center',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        #{photo.displayNumber}
                      </span>
                      {isSelected && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '2px',
                            right: '2px',
                            width: '14px',
                            height: '14px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--accent-primary, #3B82F6)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#FFFFFF',
                          }}
                        >
                          <FiCheck size={9} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── 3. Storage & Download Destination ────────────────────── */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            padding: '12px 14px',
            borderRadius: '10px',
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#F8FAFC',
            border: '1px solid var(--border-color)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '6px',
                  backgroundColor: '#0EA5E9',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <FiFolder size={13} />
              </div>
              <div>
                <div style={{ fontSize: '0.78125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Storage &amp; Download Destination
                </div>
                <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                  Where processed photos will be saved
                </div>
              </div>
            </div>

            <span
              style={{
                fontSize: '0.625rem',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '10px',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
                border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                color: 'var(--text-secondary)',
              }}
            >
              Default: /Downloads
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Folder / Directory Path
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="text"
                value={downloadFolder}
                onChange={(e) => {
                  const val = e.target.value;
                  setDownloadFolder(val);
                  onUpdateBox(box.id, { downloadFolder: val });
                  localStorage.setItem('ea_crop_download_folder', val);
                }}
                placeholder="/Downloads"
                style={{
                  flex: 1,
                  height: '32px',
                  padding: '0 10px',
                  fontSize: '0.75rem',
                  borderRadius: '6px',
                  border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                  backgroundColor: isDark ? '#0D1117' : '#FFFFFF',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={async () => {
                  if ('showDirectoryPicker' in window) {
                    try {
                      const handle = await (window as any).showDirectoryPicker();
                      const path = `/${handle.name}`;
                      setDownloadFolder(path);
                      onUpdateBox(box.id, { downloadFolder: path });
                      localStorage.setItem('ea_crop_download_folder', path);
                    } catch (_) {}
                  } else {
                    setDownloadFolder('/Downloads');
                    onUpdateBox(box.id, { downloadFolder: '/Downloads' });
                    localStorage.setItem('ea_crop_download_folder', '/Downloads');
                  }
                }}
                style={{
                  height: '32px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                  color: 'var(--text-primary)',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap',
                }}
              >
                <FiFolderPlus size={12} />
                <span>Browse...</span>
              </button>
            </div>
            <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              When downloading from &quot;{nodeTitle || box.title}&quot;, photos will be saved directly or organized into a subfolder named <code>/{(nodeTitle || box.title || 'Photo-Format').replace(/^Format:\s*/i, '').replace(/[\/\\?%*:|"<>]/g, '').trim()}</code> in this location.
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────────── */}
      <div
        style={{
          padding: '0.875rem 1.125rem',
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
          onClick={onClose}
          style={{ fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}
        >
          <FiCheckCircle size={13} />
          <span>Done & Apply Settings</span>
        </Button>
      </div>
    </div>
  );
};
