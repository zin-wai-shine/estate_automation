import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  FiCheck,
  FiUploadCloud,
  FiSave,
  FiTrash2,
  FiEye,
  FiEyeOff,
  FiSliders,
  FiGrid,
  FiType,
  FiImage as FiImageIcon,
  FiRefreshCw,
  FiDownload,
  FiAlertCircle,
  FiShield,
  FiArrowLeft,
  FiArrowRight,
} from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';
import { motion, AnimatePresence } from 'framer-motion';
import type {
  WatermarkConfig,
  WatermarkPreset,
  WatermarkPosition,
  WatermarkType,
  WatermarkScope,
} from './watermarkStorage';
import {
  DEFAULT_WATERMARK_CONFIG,
  DEFAULT_PRESETS,
  SAMPLE_BADGES,
  loadWatermarkPresets,
  saveWatermarkPresets,
  loadActiveWatermarkConfig,
  saveActiveWatermarkConfig,
} from './watermarkStorage';
import { renderWatermarkedImage } from './watermarkCanvas';
import type { AutoPostImage } from './autoPostStorage';

interface WatermarkSessionViewProps {
  images: AutoPostImage[];
  projectName: string;
  onUpdateImages: (updated: AutoPostImage[]) => void;
  showToast: (msg: string) => void;
  onNavigateToContent?: () => void;
  onNavigateToImages?: () => void;
}

const POSITION_LABELS: Record<WatermarkPosition, string> = {
  'top-left': 'Top Left',
  'top-center': 'Top Center',
  'top-right': 'Top Right',
  'center-left': 'Center Left',
  'center': 'Center',
  'center-right': 'Center Right',
  'bottom-left': 'Bottom Left',
  'bottom-center': 'Bottom Center',
  'bottom-right': 'Bottom Right',
};

const NINE_POSITIONS: WatermarkPosition[] = [
  'top-left',
  'top-center',
  'top-right',
  'center-left',
  'center',
  'center-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];

export const WatermarkSessionView: React.FC<WatermarkSessionViewProps> = ({
  images,
  projectName,
  onUpdateImages,
  showToast,
  onNavigateToContent,
  onNavigateToImages,
}) => {
  // Load saved configuration and presets
  const [presets, setPresets] = useState<WatermarkPreset[]>(() => loadWatermarkPresets());
  const initialData = useMemo(() => loadActiveWatermarkConfig(), []);
  const [config, setConfig] = useState<WatermarkConfig>(initialData.config);
  const [activePresetId, setActivePresetId] = useState<string>(initialData.activePresetId);

  // Active preview image
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  const activeImage = images[selectedImageIndex] || images[0];

  // UI States
  const [isPreviewMode, setIsPreviewMode] = useState<boolean>(false);
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [isSavingPresetModalOpen, setIsSavingPresetModalOpen] = useState<boolean>(false);
  const [newPresetName, setNewPresetName] = useState<string>('');
  const [previewDataUrl, setPreviewDataUrl] = useState<string>('');
  const [isRenderingPreview, setIsRenderingPreview] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-save active config whenever changed
  useEffect(() => {
    saveActiveWatermarkConfig(config, activePresetId);
  }, [config, activePresetId]);

  // Dynamic tags for text watermark
  const dynamicTags = useMemo(
    () => ({
      project: projectName || 'Condo Listing',
      phone: '081-234-5678',
      line: '@estatebangkok',
    }),
    [projectName]
  );

  // Live Canvas Preview update
  useEffect(() => {
    let isCancelled = false;
    const updatePreview = async () => {
      if (!activeImage) return;
      setIsRenderingPreview(true);
      try {
        const sourceUrl = activeImage.originalUrl || activeImage.url;
        if (!config.enabled || isPreviewMode) {
          // If clean preview or disabled, show clean source
          if (!isCancelled) setPreviewDataUrl(sourceUrl);
        } else {
          const url = await renderWatermarkedImage({
            sourceImageUrl: sourceUrl,
            config,
            dynamicTags,
            format: 'image/jpeg',
            quality: 0.92,
          });
          if (!isCancelled) setPreviewDataUrl(url);
        }
      } catch (err) {
        console.warn('Preview render error:', err);
        if (!isCancelled) setPreviewDataUrl(activeImage.originalUrl || activeImage.url);
      } finally {
        if (!isCancelled) setIsRenderingPreview(false);
      }
    };

    updatePreview();
    return () => {
      isCancelled = true;
    };
  }, [activeImage, config, isPreviewMode, dynamicTags]);

  // Handle Preset Selection
  const handleSelectPreset = (presetId: string) => {
    const target = presets.find((p) => p.id === presetId);
    if (!target) return;
    setActivePresetId(presetId);
    setConfig({ ...target.config });
    showToast(`Loaded preset: ${target.name}`);
  };

  // Handle Save Current Setup as New Preset
  const handleSavePreset = () => {
    const cleanName = newPresetName.trim();
    if (!cleanName) {
      alert('Please enter a preset name');
      return;
    }
    const newPreset: WatermarkPreset = {
      id: `preset-${Date.now()}`,
      name: cleanName,
      config: { ...config },
    };
    const updated = [newPreset, ...presets];
    setPresets(updated);
    saveWatermarkPresets(updated);
    setActivePresetId(newPreset.id);
    setIsSavingPresetModalOpen(false);
    setNewPresetName('');
    showToast(`Saved preset: "${cleanName}"`);
  };

  // Handle Delete Custom Preset
  const handleDeletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (presets.length <= 1) {
      alert('At least one preset must remain.');
      return;
    }
    const updated = presets.filter((p) => p.id !== id);
    setPresets(updated);
    saveWatermarkPresets(updated);
    if (activePresetId === id) {
      const next = updated[0];
      setActivePresetId(next.id);
      setConfig({ ...next.config });
    }
    showToast('Deleted preset');
  };

  // Handle Custom Logo Upload
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a PNG, SVG, or JPG image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setConfig((prev) => ({
          ...prev,
          type: 'logo',
          logoUrl: result,
          logoName: file.name,
        }));
        showToast(`Uploaded custom logo: ${file.name}`);
      }
    };
    reader.readAsDataURL(file);
  };

  // Apply Watermark to Post Images
  const handleApplyWatermarkToImages = async () => {
    if (images.length === 0) {
      alert('No images uploaded in this post.');
      return;
    }
    setIsApplying(true);

    try {
      const updatedImages = await Promise.all(
        images.map(async (img) => {
          // Check smart scope
          const section = img.section || 'body';
          let shouldApply = false;

          if (config.smartScope === 'all') {
            shouldApply = true;
          } else if (config.smartScope === 'body-only') {
            shouldApply = section === 'body';
          } else if (config.smartScope === 'body-and-footer') {
            shouldApply = section === 'body' || section === 'footer';
          }

          const originalSource = img.originalUrl || img.url;

          if (!shouldApply || !config.enabled) {
            return {
              ...img,
              url: originalSource,
              originalUrl: originalSource,
              watermarked: false,
            };
          }

          const watermarkedDataUrl = await renderWatermarkedImage({
            sourceImageUrl: originalSource,
            config,
            dynamicTags,
            format: 'image/jpeg',
            quality: 0.95,
          });

          return {
            ...img,
            url: watermarkedDataUrl,
            originalUrl: originalSource,
            watermarked: true,
          };
        })
      );

      onUpdateImages(updatedImages);
      const watermarkedCount = updatedImages.filter((i) => i.watermarked).length;
      showToast(`Smart Watermark applied to ${watermarkedCount} photo(s)!`);
    } catch (err) {
      console.error('Failed to apply watermarks:', err);
      alert('Encountered an issue applying watermarks to photos.');
    } finally {
      setIsApplying(false);
    }
  };

  // Revert All Images to Clean Originals
  const handleRevertToOriginals = () => {
    const reverted = images.map((img) => ({
      ...img,
      url: img.originalUrl || img.url,
      watermarked: false,
    }));
    onUpdateImages(reverted);
    showToast('Reverted all images to clean unwatermarked originals.');
  };

  // Download Current Watermarked Preview
  const handleDownloadPreview = () => {
    if (!previewDataUrl) return;
    const a = document.createElement('a');
    a.href = previewDataUrl;
    a.download = `${activeImage?.name?.replace(/\.[^/.]+$/, '') || 'photo'}-watermarked.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Downloaded preview image');
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        width: '100%',
        maxWidth: '1440px',
        margin: '0 auto',
      }}
    >
      {/* Top Banner / Session Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '0.875rem 1.25rem',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '9px',
              backgroundColor: config.enabled ? 'rgba(59, 130, 246, 0.15)' : 'rgba(156, 163, 175, 0.12)',
              color: config.enabled ? 'var(--accent-primary)' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.125rem',
            }}
          >
            <FiShield />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Watermark Studio
              </span>
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: config.enabled ? 'rgba(34, 197, 94, 0.15)' : 'rgba(156, 163, 175, 0.12)',
                  color: config.enabled ? '#16A34A' : 'var(--text-muted)',
                  border: config.enabled ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid var(--border-color)',
                }}
              >
                {config.enabled ? 'Protection Active' : 'Clean / Disabled'}
              </span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Brand protect property photos with saved presets, 9-point grid anchor, and smart gallery targeting.
            </span>
          </div>
        </div>

        {/* Right Session Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Clean Preview / Hide Guides Button */}
          <button
            type="button"
            onClick={() => setIsPreviewMode((prev) => !prev)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              height: '32px',
              padding: '0 12px',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: '7px',
              border: isPreviewMode ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
              backgroundColor: isPreviewMode ? 'var(--accent-primary-alpha)' : 'var(--bg-main)',
              color: isPreviewMode ? 'var(--accent-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title={isPreviewMode ? 'Show watermark guides and outlines' : 'Hide guides for clean visual preview'}
          >
            {isPreviewMode ? <FiEyeOff size={13} /> : <FiEye size={13} />}
            <span>{isPreviewMode ? 'Guides Hidden' : 'Clean Preview'}</span>
            <span
              style={{
                fontSize: '0.625rem',
                padding: '1px 5px',
                borderRadius: '4px',
                backgroundColor: isPreviewMode ? 'var(--accent-primary)' : 'rgba(156, 163, 175, 0.15)',
                color: isPreviewMode ? '#FFFFFF' : 'var(--text-muted)',
              }}
            >
              {isPreviewMode ? 'LOCKED' : 'HIDE GUIDES'}
            </span>
          </button>

          {/* Save As Preset Button */}
          <button
            type="button"
            onClick={() => {
              setNewPresetName(`Preset ${presets.length + 1} (${POSITION_LABELS[config.position]})`);
              setIsSavingPresetModalOpen(true);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              height: '32px',
              padding: '0 12px',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: '7px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-main)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <FiSave size={13} />
            <span>Save Setup</span>
          </button>

          {/* Quick Download Preview */}
          <button
            type="button"
            onClick={handleDownloadPreview}
            disabled={!previewDataUrl}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              height: '32px',
              padding: '0 12px',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: '7px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-main)',
              color: 'var(--text-primary)',
              cursor: previewDataUrl ? 'pointer' : 'not-allowed',
              opacity: previewDataUrl ? 1 : 0.6,
            }}
            title="Download this watermarked preview image"
          >
            <FiDownload size={13} />
            <span>Download Tile</span>
          </button>

          {/* Quick Navigation to Images & Content */}
          {onNavigateToImages && (
            <button
              type="button"
              onClick={onNavigateToImages}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                height: '32px',
                padding: '0 10px',
                fontSize: '0.75rem',
                fontWeight: 600,
                borderRadius: '7px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
              title="Return to Images workspace session"
            >
              <FiArrowLeft size={13} />
              <span>Images</span>
            </button>
          )}

          {onNavigateToContent && (
            <button
              type="button"
              onClick={onNavigateToContent}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                height: '32px',
                padding: '0 12px',
                fontSize: '0.75rem',
                fontWeight: 600,
                borderRadius: '7px',
                border: 'none',
                backgroundColor: 'var(--accent-primary)',
                color: '#FFFFFF',
                cursor: 'pointer',
              }}
              title="Proceed to Content review and publishing"
            >
              <span>Content</span>
              <FiArrowRight size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Main Studio Two-Column Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.35fr) minmax(360px, 420px)',
          gap: '1.25rem',
          alignItems: 'start',
        }}
      >
        {/* ======================================================== */}
        {/* LEFT COLUMN: INTERACTIVE LIVE CANVAS & PHOTO STRIP       */}
        {/* ======================================================== */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.875rem',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '14px',
            padding: '1.125rem',
          }}
        >
          {/* Preview Header & Photo Info */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: '0.75rem',
              borderBottom: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Live Canvas Preview
              </span>
              <span
                style={{
                  fontSize: '0.6875rem',
                  color: 'var(--text-secondary)',
                  backgroundColor: 'rgba(156, 163, 175, 0.1)',
                  padding: '2px 8px',
                  borderRadius: '10px',
                }}
              >
                {activeImage ? activeImage.name : 'No image'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {activeImage?.section && (
                <span
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    backgroundColor:
                      activeImage.section === 'header'
                        ? 'rgba(245, 158, 11, 0.15)'
                        : activeImage.section === 'body'
                        ? 'rgba(59, 130, 246, 0.15)'
                        : 'rgba(16, 185, 129, 0.15)',
                    color:
                      activeImage.section === 'header'
                        ? '#F59E0B'
                        : activeImage.section === 'body'
                        ? '#3B82F6'
                        : '#10B981',
                  }}
                >
                  {activeImage.section}
                </span>
              )}

              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  backgroundColor: activeImage?.watermarked
                    ? 'rgba(34, 197, 94, 0.15)'
                    : 'rgba(156, 163, 175, 0.12)',
                  color: activeImage?.watermarked ? '#16A34A' : 'var(--text-muted)',
                }}
              >
                {activeImage?.watermarked ? 'Watermarked in Post' : 'Clean Original'}
              </span>
            </div>
          </div>

          {/* Canvas Display Viewport */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              minHeight: '440px',
              maxHeight: '560px',
              backgroundColor: '#0F172A',
              borderRadius: '10px',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundImage:
                'radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 0)',
              backgroundSize: '20px 20px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            {isRenderingPreview && (
              <div
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  zIndex: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'rgba(0, 0, 0, 0.75)',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  fontSize: '0.6875rem',
                  color: '#93C5FD',
                  backdropFilter: 'blur(4px)',
                }}
              >
                <FiRefreshCw className="animate-spin" size={11} />
                <span>Rendering...</span>
              </div>
            )}

            {previewDataUrl ? (
              <img
                src={previewDataUrl}
                alt="Watermarked Preview"
                style={{
                  maxWidth: '100%',
                  maxHeight: '520px',
                  objectFit: 'contain',
                  borderRadius: '6px',
                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
                  transition: 'opacity 0.15s ease',
                }}
              />
            ) : (
              <div style={{ textAlign: 'center', color: '#94A3B8' }}>
                <FiAlertCircle size={32} style={{ marginBottom: '8px' }} />
                <p style={{ fontSize: '0.875rem' }}>No photo selected for preview</p>
              </div>
            )}

            {/* Smart scope indicator pill on viewport */}
            {config.enabled && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '12px',
                  left: '12px',
                  backgroundColor: 'rgba(15, 23, 42, 0.85)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  padding: '4px 10px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.6875rem',
                  color: '#F8FAFC',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: config.enabled ? '#22C55E' : '#94A3B8',
                  }}
                />
                <span>Anchor: {POSITION_LABELS[config.position]}</span>
                <span style={{ color: '#94A3B8' }}>•</span>
                <span style={{ color: '#93C5FD' }}>{config.opacity}% Opacity</span>
              </div>
            )}
          </div>

          {/* Photo Strip / Album Carousel */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.5rem',
              }}
            >
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                SELECT POST PHOTO TO TEST ({images.length} PHOTOS)
              </span>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                Click photo to preview watermark positioning
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                gap: '8px',
                maxHeight: '140px',
                overflowY: 'auto',
                padding: '4px',
              }}
            >
              {images.map((img, idx) => {
                const isSelected = selectedImageIndex === idx;
                return (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setSelectedImageIndex(idx)}
                    style={{
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      padding: '4px',
                      borderRadius: '8px',
                      border: isSelected
                        ? '2px solid var(--accent-primary)'
                        : '1px solid var(--border-color)',
                      backgroundColor: isSelected ? 'var(--accent-primary-alpha)' : 'var(--bg-main)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                      outline: 'none',
                    }}
                  >
                    <div
                      style={{
                        position: 'relative',
                        width: '100%',
                        height: '60px',
                        borderRadius: '5px',
                        overflow: 'hidden',
                        backgroundColor: '#1E293B',
                      }}
                    >
                      <img
                        src={img.originalUrl || img.url}
                        alt={img.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                      {img.isCover && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '3px',
                            left: '3px',
                            backgroundColor: '#F59E0B',
                            color: '#FFFFFF',
                            fontSize: '0.5625rem',
                            fontWeight: 700,
                            padding: '1px 4px',
                            borderRadius: '3px',
                          }}
                        >
                          HERO
                        </div>
                      )}
                      {isSelected && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '3px',
                            right: '3px',
                            backgroundColor: 'var(--accent-primary)',
                            color: '#FFFFFF',
                            borderRadius: '50%',
                            width: '16px',
                            height: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.625rem',
                          }}
                        >
                          <FiCheck />
                        </div>
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: isSelected ? 600 : 500,
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        marginTop: '3px',
                      }}
                    >
                      {img.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* RIGHT COLUMN: WATERMARK CONTROLS PANE                    */}
        {/* Reference Image 2 Style: Clean, Cool, Professional       */}
        {/* ======================================================== */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '14px',
            padding: '1.25rem',
          }}
        >
          {/* Controls Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: '0.75rem',
              borderBottom: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <FiSliders style={{ color: 'var(--accent-primary)', fontSize: '0.9375rem' }} />
              <span
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: 800,
                  letterSpacing: '0.5px',
                  color: 'var(--text-primary)',
                  textTransform: 'uppercase',
                }}
              >
                Watermark Controls
              </span>
            </div>
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                color: 'var(--text-muted)',
              }}
            >
              Smart Setup
            </span>
          </div>

          {/* 1. Master Switch: Use Watermark */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 0.875rem',
              borderRadius: '9px',
              backgroundColor: 'var(--bg-main)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Use Watermark
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
                {config.enabled ? 'Apply watermark to post photos' : 'Clean slices (no watermark)'}
              </div>
            </div>

            {/* Toggle Switch Button */}
            <button
              type="button"
              onClick={() => setConfig((prev) => ({ ...prev, enabled: !prev.enabled }))}
              style={{
                position: 'relative',
                width: '42px',
                height: '24px',
                borderRadius: '12px',
                backgroundColor: config.enabled ? 'var(--accent-primary)' : 'rgba(156, 163, 175, 0.3)',
                border: 'none',
                cursor: 'pointer',
                transition: 'background-color 0.2s ease',
                padding: '2px',
                outline: 'none',
              }}
              title={config.enabled ? 'Disable watermark' : 'Enable watermark'}
            >
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  backgroundColor: '#FFFFFF',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
                  transform: config.enabled ? 'translateX(18px)' : 'translateX(0px)',
                  transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              />
            </button>
          </div>

          {/* 2. Saved Presets Library */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
                SAVED WATERMARKS ({presets.length})
              </span>
              <button
                type="button"
                onClick={() => {
                  setNewPresetName(`Custom ${presets.length + 1}`);
                  setIsSavingPresetModalOpen(true);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-primary)',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                + New Preset
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {presets.map((p) => {
                const isActive = activePresetId === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectPreset(p.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      borderRadius: '7px',
                      border: isActive
                        ? '1px solid var(--accent-primary)'
                        : '1px solid var(--border-color)',
                      backgroundColor: isActive ? 'var(--accent-primary-alpha)' : 'var(--bg-main)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                      <span
                        style={{
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          backgroundColor: isActive ? 'var(--accent-primary)' : 'var(--text-muted)',
                        }}
                      />
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: isActive ? 600 : 500,
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {p.name}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        style={{
                          fontSize: '0.625rem',
                          color: 'var(--text-secondary)',
                          backgroundColor: 'rgba(156, 163, 175, 0.12)',
                          padding: '1px 5px',
                          borderRadius: '4px',
                        }}
                      >
                        {POSITION_LABELS[p.config.position]}
                      </span>
                      {!p.isDefault && (
                        <button
                          type="button"
                          onClick={(e) => handleDeletePreset(p.id, e)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '2px',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                          title="Delete preset"
                        >
                          <FiTrash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Watermark Mode Toggle: Logo vs Text */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
              WATERMARK TYPE
            </span>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                padding: '3px',
                backgroundColor: 'var(--bg-main)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                gap: '4px',
              }}
            >
              <button
                type="button"
                onClick={() => setConfig((prev) => ({ ...prev, type: 'logo' }))}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  height: '30px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: config.type === 'logo' ? 'var(--accent-primary)' : 'transparent',
                  color: config.type === 'logo' ? '#FFFFFF' : 'var(--text-secondary)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <FiImageIcon size={13} />
                <span>Logo / Badge</span>
              </button>

              <button
                type="button"
                onClick={() => setConfig((prev) => ({ ...prev, type: 'text' }))}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  height: '30px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: config.type === 'text' ? 'var(--accent-primary)' : 'transparent',
                  color: config.type === 'text' ? '#FFFFFF' : 'var(--text-secondary)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <FiType size={13} />
                <span>Text Branding</span>
              </button>
            </div>
          </div>

          {/* 4. Type Specific Settings */}
          {config.type === 'logo' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
                LOGO BADGE
              </span>

              {/* Sample Logo Quick Picker */}
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
                {[
                  { label: 'Gold Shield', url: SAMPLE_BADGES.goldShield },
                  { label: 'Prime Blue', url: SAMPLE_BADGES.modernMinimal },
                  { label: 'Exclusive EA', url: SAMPLE_BADGES.luxurySignature },
                ].map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() =>
                      setConfig((prev) => ({
                        ...prev,
                        logoUrl: s.url,
                        logoName: s.label,
                      }))
                    }
                    style={{
                      padding: '4px 8px',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      borderRadius: '6px',
                      border:
                        config.logoUrl === s.url
                          ? '1px solid var(--accent-primary)'
                          : '1px solid var(--border-color)',
                      backgroundColor:
                        config.logoUrl === s.url ? 'var(--accent-primary-alpha)' : 'var(--bg-main)',
                      color: config.logoUrl === s.url ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Upload Custom Logo Button */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/svg+xml,image/jpeg"
                style={{ display: 'none' }}
                onChange={handleLogoUpload}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  height: '32px',
                  borderRadius: '7px',
                  border: '1px dashed var(--border-color)',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-primary)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <FiUploadCloud size={14} />
                <span>Upload Custom Logo (PNG / SVG)</span>
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
                TEXT CONTENT
              </span>
              <input
                type="text"
                value={config.text}
                onChange={(e) => setConfig((prev) => ({ ...prev, text: e.target.value }))}
                placeholder="{project} · Tel: 081-234-5678"
                style={{
                  height: '34px',
                  padding: '0 10px',
                  fontSize: '0.8125rem',
                  borderRadius: '7px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              />

              {/* Dynamic tag insert helpers */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>Insert tag:</span>
                {[
                  { tag: '{project}', label: '+ Project Name' },
                  { tag: '{phone}', label: '+ Phone' },
                  { tag: '{line}', label: '+ Line ID' },
                ].map((t) => (
                  <button
                    key={t.tag}
                    type="button"
                    onClick={() =>
                      setConfig((prev) => ({
                        ...prev,
                        text: prev.text ? `${prev.text} · ${t.tag}` : t.tag,
                      }))
                    }
                    style={{
                      background: 'none',
                      border: '1px solid var(--border-color)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '0.625rem',
                      color: 'var(--accent-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 5. 9-Dot Position Grid (Clean recreation from Reference Image 2) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
                ANCHOR POSITION
              </span>
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  color: 'var(--accent-primary)',
                  backgroundColor: 'var(--accent-primary-alpha)',
                  padding: '1px 6px',
                  borderRadius: '4px',
                }}
              >
                {POSITION_LABELS[config.position]}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '10px',
                borderRadius: '9px',
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
              }}
            >
              {/* 3x3 Dot Matrix */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 26px)',
                  gridTemplateRows: 'repeat(3, 26px)',
                  gap: '6px',
                  padding: '8px',
                  borderRadius: '8px',
                  backgroundColor: '#0F172A',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                {NINE_POSITIONS.map((pos) => {
                  const isActive = config.position === pos;
                  return (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, position: pos }))}
                      style={{
                        position: 'relative',
                        width: '26px',
                        height: '26px',
                        borderRadius: '5px',
                        border: isActive ? '1.5px solid #FFFFFF' : '1px solid transparent',
                        backgroundColor: isActive ? '#3B82F6' : 'rgba(255, 255, 255, 0.08)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0,
                        transition: 'all 0.12s ease',
                      }}
                      title={`Anchor to ${POSITION_LABELS[pos]}`}
                    >
                      <span
                        style={{
                          width: isActive ? '8px' : '5px',
                          height: isActive ? '8px' : '5px',
                          borderRadius: '50%',
                          backgroundColor: isActive ? '#FFFFFF' : 'rgba(255, 255, 255, 0.4)',
                        }}
                      />
                    </button>
                  );
                })}
              </div>

              {/* Informational readout */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {POSITION_LABELS[config.position]}
                </span>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
                  Anchors with {config.margin}% edge padding for safe margin across standard aspect ratios.
                </span>
              </div>
            </div>
          </div>

          {/* 6. Sizing, Opacity & Margin Sliders */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Opacity Slider */}
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '4px',
                }}
              >
                <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  OPACITY
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {config.opacity}%
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={config.opacity}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, opacity: Number(e.target.value) }))
                }
                style={{ width: '100%', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
              />
            </div>

            {/* Scale / Size Slider */}
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '4px',
                }}
              >
                <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  SIZE / SCALE
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {config.scale}%
                </span>
              </div>
              <input
                type="range"
                min="12"
                max="45"
                step="2"
                value={config.scale}
                onChange={(e) => setConfig((prev) => ({ ...prev, scale: Number(e.target.value) }))}
                style={{ width: '100%', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
              />
            </div>

            {/* Margin Slider */}
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '4px',
                }}
              >
                <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  EDGE PADDING
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {config.margin}%
                </span>
              </div>
              <input
                type="range"
                min="2"
                max="10"
                step="1"
                value={config.margin}
                onChange={(e) => setConfig((prev) => ({ ...prev, margin: Number(e.target.value) }))}
                style={{ width: '100%', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
              />
            </div>
          </div>

          {/* 7. Smart Application Scope */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
              SMART APPLICATION SCOPE
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[
                {
                  key: 'body-only' as WatermarkScope,
                  title: 'Gallery Only (Recommended)',
                  desc: 'Protects interior showcase photos while keeping Cover Hero clean for high CTR',
                },
                {
                  key: 'all' as WatermarkScope,
                  title: 'All Photos',
                  desc: 'Apply watermark across all Header, Body, and Footer photos',
                },
              ].map((scope) => {
                const isSelected = config.smartScope === scope.key;
                return (
                  <div
                    key={scope.key}
                    onClick={() => setConfig((prev) => ({ ...prev, smartScope: scope.key }))}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: isSelected
                        ? '1.5px solid var(--accent-primary)'
                        : '1px solid var(--border-color)',
                      backgroundColor: isSelected ? 'var(--accent-primary-alpha)' : 'var(--bg-main)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div
                      style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        border: isSelected
                          ? '4px solid var(--accent-primary)'
                          : '1px solid var(--text-muted)',
                        backgroundColor: '#FFFFFF',
                        marginTop: '2px',
                        flexShrink: 0,
                      }}
                    />
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {scope.title}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
                        {scope.desc}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 8. Action Footer */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              paddingTop: '0.75rem',
              borderTop: '1px solid var(--border-color)',
            }}
          >
            {/* Primary Action: Apply Watermark */}
            <button
              type="button"
              onClick={handleApplyWatermarkToImages}
              disabled={isApplying}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                height: '38px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'var(--accent-primary)',
                color: '#FFFFFF',
                fontSize: '0.8125rem',
                fontWeight: 700,
                cursor: isApplying ? 'not-allowed' : 'pointer',
                opacity: isApplying ? 0.7 : 1,
                boxShadow: '0 2px 6px rgba(59, 130, 246, 0.35)',
                transition: 'all 0.15s ease',
              }}
            >
              {isApplying ? (
                <>
                  <FiRefreshCw className="animate-spin" size={14} />
                  <span>Processing Watermarks...</span>
                </>
              ) : (
                <>
                  <HiSparkles size={14} />
                  <span>Apply Watermark to Post Images</span>
                </>
              )}
            </button>

            {/* Secondary: Revert to Clean Originals */}
            <button
              type="button"
              onClick={handleRevertToOriginals}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                height: '32px',
                borderRadius: '7px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <span>Revert to Clean Originals</span>
            </button>
          </div>
        </div>
      </div>

      {/* Save Preset Modal */}
      <AnimatePresence>
        {isSavingPresetModalOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(4px)',
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                width: '100%',
                maxWidth: '400px',
                padding: '1.5rem',
                borderRadius: '12px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
              }}
            >
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                Save Watermark Preset
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Save current position, logo/text, opacity, and smart scope into your reusable library.
              </p>

              <input
                type="text"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                placeholder="e.g. Official Agency Badge"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSavePreset();
                  if (e.key === 'Escape') setIsSavingPresetModalOpen(false);
                }}
                style={{
                  width: '100%',
                  height: '36px',
                  padding: '0 10px',
                  fontSize: '0.8125rem',
                  borderRadius: '7px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-primary)',
                  marginBottom: '1.25rem',
                  outline: 'none',
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsSavingPresetModalOpen(false)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'transparent',
                    color: 'var(--text-secondary)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSavePreset}
                  style={{
                    padding: '6px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: 'var(--accent-primary)',
                    color: '#FFFFFF',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Save Preset
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
