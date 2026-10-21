import React, { useState, useMemo, useEffect } from 'react';
import { FiEdit2, FiMaximize2, FiCheck, FiX } from 'react-icons/fi';
import {
  type CropStudioFormat,
  getSavedCropFormats,
  renameCropFormat,
  formatImageWithCropFormat,
  syncCropFormatToWorkflowConfig,
} from '../watermark/cropFormats';
import type { DynamicAIBoxConfig } from './FacebookWorkflowCanvas';
import { Select, type SelectOption } from '../../components/ui/Select';
import { PhotoLightboxModal } from './PhotoLightboxModal';

interface WatermarkNodeModalProps {
  box: DynamicAIBoxConfig;
  isDark: boolean;
  onUpdateBox: (id: string, updates: Partial<DynamicAIBoxConfig>) => void;
  onDeleteBox?: (id: string) => void;
  onClose?: () => void;
  images?: Array<{
    index: number;
    facebook_photo_id?: string;
    source_url: string;
    stored_url?: string;
    width?: number;
    height?: number;
    status?: string;
  }>;
  watermarkedPhotos?: Record<number, string>;
  enhancedPhotos?: Record<number, string>;
  onOpenLightbox?: (index: number) => void;
}

export const WatermarkNodeModal: React.FC<WatermarkNodeModalProps> = ({
  box,
  isDark,
  onUpdateBox,
  images,
  watermarkedPhotos,
  enhancedPhotos,
  onOpenLightbox,
}) => {
  const [savedFormats, setSavedFormats] = useState<CropStudioFormat[]>(() => getSavedCropFormats());
  const [isEditingFormatName, setIsEditingFormatName] = useState<boolean>(false);
  const [formatNameInput, setFormatNameInput] = useState<string>('');

  useEffect(() => {
    const handleSync = () => {
      setSavedFormats(getSavedCropFormats());
    };
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

  const [nodeTitle, setNodeTitle] = useState<string>(box.title || 'Photo Format');

  React.useEffect(() => {
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
    setNodeTitle(box.title || 'Photo Format');
  }, [box.id, box.cropFormatId, box.templateId, box.templateText, box.title, savedFormats]);

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [liveFormattedPhotos, setLiveFormattedPhotos] = useState<Record<number, string>>({});

  const formatOptions = useMemo<SelectOption[]>(() => {
    return savedFormats.map((f) => ({
      value: f.id,
      label: `${f.name} (${f.targetWidth}×${f.targetHeight} · ${f.aspect || '1:1'})`,
    }));
  }, [savedFormats]);

  const currentFormat = useMemo(() => {
    return (
      savedFormats.find((f) => f.id === selectedFormatId) ||
      savedFormats.find((f) => f.id === box.cropFormatId || f.id === box.templateId || f.id === box.watermarkPresetId) ||
      savedFormats.find((f) => box.templateText && f.name.toLowerCase() === box.templateText.toLowerCase()) ||
      savedFormats.find((f) => box.title && f.name && box.title.toLowerCase().includes(f.name.toLowerCase())) ||
      ((box.title?.toLowerCase().includes('fb') || box.templateText?.toLowerCase().includes('fb'))
        ? savedFormats.find((f) => f.name.toLowerCase().includes('fb'))
        : null) ||
      savedFormats[0]
    );
  }, [savedFormats, selectedFormatId, box.cropFormatId, box.templateId, box.watermarkPresetId, box.templateText, box.title]);

  // Live offscreen formatting for instant 4:5 preview
  useEffect(() => {
    if (!images || images.length === 0 || !currentFormat) return;
    let isCancelled = false;

    const generatePreviews = async () => {
      const result: Record<number, string> = {};
      for (const img of images) {
        const rawUrl = img.stored_url
          ? (img.stored_url.startsWith('http') ? img.stored_url : `http://localhost:8085${img.stored_url}`)
          : img.source_url;
        try {
          const cropped = await formatImageWithCropFormat(rawUrl, currentFormat);
          if (!isCancelled) {
            result[img.index] = cropped;
          }
        } catch {
          if (!isCancelled) {
            result[img.index] = rawUrl;
          }
        }
      }
      if (!isCancelled) {
        setLiveFormattedPhotos(result);
      }
    };

    generatePreviews();
    return () => {
      isCancelled = true;
    };
  }, [
    images,
    currentFormat?.id,
    currentFormat?.targetWidth,
    currentFormat?.targetHeight,
    currentFormat?.aspect,
    currentFormat?.fitMode,
    currentFormat?.focusPosition,
  ]);

  const handleSelectFormat = (format: CropStudioFormat) => {
    setSelectedFormatId(format.id);
    const newTitle = `Format: ${format.name}`;
    setNodeTitle(newTitle);
    onUpdateBox(box.id, {
      title: newTitle,
      subtitle: `${format.targetWidth}×${format.targetHeight} (${format.aspect || 'Crop'})`,
      cropFormatId: format.id,
      templateId: format.id,
      templateText: format.name,
      watermarkPresetId: format.id,
      targetWidth: format.targetWidth,
      targetHeight: format.targetHeight,
      aspect: format.aspect,
      fitMode: format.fitMode,
      focusPosition: format.focusPosition,
      cropZoom: format.cropZoom,
      watermarkConfig: format.watermarkConfig,
    });
    syncCropFormatToWorkflowConfig(format);
  };

  const handleTitleChange = (val: string) => {
    setNodeTitle(val);
    onUpdateBox(box.id, { title: val });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Format Selection via Select Box */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
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
      </div>

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
            backgroundColor: isDark ? 'var(--bg-surface)' : 'var(--bg-main)',
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
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (formatNameInput.trim()) {
                          renameCropFormat(currentFormat.id, formatNameInput.trim());
                          const newTitle = `Format: ${formatNameInput.trim()}`;
                          setNodeTitle(newTitle);
                          onUpdateBox(box.id, { title: newTitle, templateText: formatNameInput.trim() });
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
                        const newTitle = `Format: ${formatNameInput.trim()}`;
                        setNodeTitle(newTitle);
                        onUpdateBox(box.id, { title: newTitle, templateText: formatNameInput.trim() });
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
                  <button
                    type="button"
                    onClick={() => setIsEditingFormatName(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '22px',
                      height: '22px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'transparent',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                    title="Cancel"
                  >
                    <FiX size={11} />
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

      {/* Node Name input (compact & subtle) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          borderRadius: '6px',
          backgroundColor: isDark ? 'var(--bg-surface)' : 'var(--bg-main)',
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
          placeholder="e.g. Format: Instagram Portrait"
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

      {/* Processed Photos Live Preview (when workflow has extracted images) */}
      {images && images.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginTop: '0.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Processed Photos Preview
            </label>
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                color: '#10B981',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              ✓ {images.length} Ready · {currentFormat?.aspect || '4:5'}
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
              maxHeight: '340px',
              overflowY: 'auto',
              padding: '6px',
              borderRadius: '8px',
              border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
              backgroundColor: isDark ? '#0D1117' : '#F8FAFC',
            }}
          >
            {images.map((img, idx) => {
              const url =
                liveFormattedPhotos[img.index] ||
                watermarkedPhotos?.[img.index] ||
                enhancedPhotos?.[img.index] ||
                img.stored_url ||
                img.source_url;
              const isSelected = selectedPhotoIndex === idx;

              const cardPaddingTop =
                currentFormat?.targetWidth && currentFormat?.targetHeight
                  ? `${(currentFormat.targetHeight / currentFormat.targetWidth) * 100}%`
                  : currentFormat?.aspect === '4:5'
                  ? '125%'
                  : currentFormat?.aspect === '16:9'
                  ? '56.25%'
                  : currentFormat?.aspect === '9:16'
                  ? '177.7%'
                  : '100%';

              return (
                <div
                  key={`crop-preview-${img.index}`}
                  onClick={() => {
                    setSelectedPhotoIndex(idx);
                    if (onOpenLightbox) {
                      onOpenLightbox(idx);
                    } else {
                      setLightboxIndex(idx);
                    }
                  }}
                  style={{
                    position: 'relative',
                    width: '100%',
                    paddingTop: cardPaddingTop,
                    borderRadius: '6px',
                    overflow: 'hidden',
                    border: isSelected
                      ? '2px solid #3B82F6'
                      : isDark
                      ? '1px solid #30363D'
                      : '1px solid #CBD5E1',
                    backgroundColor: isDark ? '#161B22' : '#E2E8F0',
                    cursor: 'pointer',
                    boxShadow: isSelected ? '0 0 10px rgba(59, 130, 246, 0.4)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                  title={`Click to view Photo #${idx + 1} full size`}
                >
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <img
                      src={url}
                      alt={`Photo #${img.index + 1}`}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                    {/* Hover Overlay with Maximize Icon */}
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        opacity: 0,
                        transition: 'opacity 0.15s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#FFFFFF',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = '1';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = '0';
                      }}
                    >
                      <div
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          backgroundColor: 'rgba(0, 0, 0, 0.65)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <FiMaximize2 size={13} />
                      </div>
                    </div>

                    {/* Photo Number Badge */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '3px',
                        left: '3px',
                        fontSize: '0.5625rem',
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: '3px',
                        backgroundColor: 'rgba(0,0,0,0.75)',
                        color: '#FFFFFF',
                        pointerEvents: 'none',
                      }}
                    >
                      #{idx + 1}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              Click any photo to select & view full size
            </span>
          </div>
        </div>
      )}

      {/* Fullscreen Photo Lightbox Modal */}
      {images && images.length > 0 && lightboxIndex !== null && (
        <PhotoLightboxModal
          isOpen={lightboxIndex !== null}
          onClose={() => setLightboxIndex(null)}
          initialIndex={lightboxIndex}
          photos={images.map((img) => ({
            index: img.index,
            url:
              watermarkedPhotos?.[img.index] ||
              enhancedPhotos?.[img.index] ||
              img.stored_url ||
              img.source_url,
            name: `Photo #${img.index + 1}`,
          }))}
          title={nodeTitle || 'Photo Format & Crop'}
          formatSubtitle={`${currentFormat?.name || 'Crop Preset'} · ${currentFormat?.targetWidth || 1200}×${currentFormat?.targetHeight || 1200} (${currentFormat?.aspect || '1:1'})`}
        />
      )}
    </div>
  );
};
