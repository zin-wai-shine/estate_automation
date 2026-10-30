import React, { useState, useMemo, useEffect } from 'react';
import { FiEdit2, FiMaximize2, FiCheck, FiX, FiImage } from 'react-icons/fi';
import {
  type CropStudioFormat,
  getSavedCropFormats,
  fetchCropFormatsFromBackend,
  renameCropFormat,
  formatImageWithCropFormat,
  formatImageWithCropFormatSlices,
  type FormattedCropSlice,
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
  heroImage?: {
    url: string;
    fileName?: string;
    condoName?: string;
    createdAt?: string;
  } | null;
  onOpenLightbox?: (index: number) => void;
}

export const WatermarkNodeModal: React.FC<WatermarkNodeModalProps> = ({
  box,
  isDark,
  onUpdateBox,
  images,
  watermarkedPhotos,
  enhancedPhotos,
  heroImage,
  onOpenLightbox,
}) => {
  const [savedFormats, setSavedFormats] = useState<CropStudioFormat[]>(() => getSavedCropFormats());
  const [isEditingFormatName, setIsEditingFormatName] = useState<boolean>(false);
  const [formatNameInput, setFormatNameInput] = useState<string>('');

  useEffect(() => {
    const handleSync = () => {
      setSavedFormats(getSavedCropFormats());
    };
    fetchCropFormatsFromBackend().then((fmts) => {
      if (fmts && fmts.length > 0) setSavedFormats(fmts);
    }).catch(() => {});
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
    setNodeTitle((box.title || 'Crop & Cut').replace(/^Format:\s*/i, ''));
  }, [box.id]);

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [liveFormattedPhotos, setLiveFormattedPhotos] = useState<Record<string, string>>({});
  const [formattedPreviewItems, setFormattedPreviewItems] = useState<Array<{
    id: string;
    sourcePhotoId: string;
    url: string;
    label: string;
    tileIndex: number;
    totalTiles: number;
    width: number;
    height: number;
    aspect: string;
  }>>([]);

  // Image Source Selection: 'get_images' | 'enhance' | 'generate' | 'all'
  const [imageSource, setImageSource] = useState<'get_images' | 'enhance' | 'generate' | 'all'>(
    (box.imageSource as any) || 'get_images'
  );

  // Fallback hero image from localStorage or referenceImage
  const effectiveHeroImage = useMemo(() => {
    if (heroImage && heroImage.url) return heroImage;
    try {
      const saved = localStorage.getItem('bolthaven_last_hero_image');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    if (box.referenceImage) {
      return { url: box.referenceImage, fileName: 'hero_reference.png' };
    }
    return null;
  }, [heroImage, box.referenceImage]);

  // Build the list of photos available for the currently selected source
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

    // 1. Get Images (Raw extracted)
    if (imageSource === 'get_images' || imageSource === 'all') {
      if (images && images.length > 0) {
        images.forEach((img, idx) => {
          const photoNum = typeof img.index === 'number' && img.index > 0 ? img.index : idx + 1;
          const url =
            watermarkedPhotos?.[img.index] ||
            (img.stored_url
              ? (img.stored_url.startsWith('http') ? img.stored_url : `http://localhost:8085${img.stored_url}`)
              : img.source_url);
          rawList.push({
            id: `raw-${photoNum}`,
            index: photoNum,
            displayNumber: idx + 1,
            url,
            source: 'get_images',
            label: `Photo #${idx + 1}`,
          });
        });
      }
    }

    // 2. Enhanced Images
    if (imageSource === 'enhance' || (imageSource === 'all' && enhancedPhotos && Object.keys(enhancedPhotos).length > 0)) {
      if (imageSource === 'enhance') {
        if (images && images.length > 0) {
          images.forEach((img, idx) => {
            const photoNum = typeof img.index === 'number' && img.index > 0 ? img.index : idx + 1;
            const enhUrl = enhancedPhotos?.[img.index] || enhancedPhotos?.[idx];
            const fallbackUrl = img.stored_url
              ? (img.stored_url.startsWith('http') ? img.stored_url : `http://localhost:8085${img.stored_url}`)
              : img.source_url;
            rawList.push({
              id: `enh-${photoNum}`,
              index: photoNum,
              displayNumber: idx + 1,
              url: enhUrl || fallbackUrl,
              source: 'enhance',
              label: enhUrl ? `Enhanced #${idx + 1}` : `Photo #${idx + 1}`,
              isEnhanced: Boolean(enhUrl),
            });
          });
        }
      } else {
        if (enhancedPhotos) {
          Object.entries(enhancedPhotos).forEach(([k, url]) => {
            const num = Number(k) + 1;
            rawList.push({
              id: `enh-${num}`,
              index: 100 + num,
              displayNumber: num,
              url,
              source: 'enhance',
              label: `Enhanced #${num}`,
              isEnhanced: true,
            });
          });
        }
      }
    }

    // 3. Generate Image (Hero)
    if (imageSource === 'generate' || imageSource === 'all') {
      if (effectiveHeroImage && effectiveHeroImage.url) {
        rawList.push({
          id: 'hero-1',
          index: imageSource === 'generate' ? 1 : 999,
          displayNumber: 1,
          url: effectiveHeroImage.url,
          source: 'generate',
          label: effectiveHeroImage.condoName ? `${effectiveHeroImage.condoName} Hero` : 'Generated Hero',
        });
      } else if (imageSource === 'generate') {
        const firstRaw = images?.[0];
        if (firstRaw) {
          const url = firstRaw.stored_url
            ? (firstRaw.stored_url.startsWith('http') ? firstRaw.stored_url : `http://localhost:8085${firstRaw.stored_url}`)
            : firstRaw.source_url;
          rawList.push({
            id: 'hero-target-1',
            index: 1,
            displayNumber: 1,
            url,
            source: 'generate',
            label: 'Hero Generator Target Photo #1',
          });
        }
      }
    }

    return rawList;
  }, [imageSource, images, enhancedPhotos, effectiveHeroImage]);

  const [selectedIndices, setSelectedIndices] = useState<number[]>(() => {
    if (Array.isArray(box.selectedImageIndices) && box.selectedImageIndices.length > 0) {
      return box.selectedImageIndices;
    }
    return [];
  });

  // Synchronize selection indices with current source list
  useEffect(() => {
    if (currentSourceList.length > 0) {
      if (selectedIndices.length === 0 || !selectedIndices.some((idx) => currentSourceList.some((p) => p.index === idx))) {
        const all = currentSourceList.map((p) => p.index);
        setSelectedIndices(all);
        onUpdateBox(box.id, { selectedImageIndices: all });
      }
    }
  }, [imageSource, currentSourceList.length]);

  useEffect(() => {
    if (box.imageSource && box.imageSource !== imageSource) {
      setImageSource(box.imageSource as any);
    }
    if (Array.isArray(box.selectedImageIndices)) {
      setSelectedIndices(box.selectedImageIndices);
    }
  }, [box.imageSource, box.selectedImageIndices]);

  const activePhotosToFormat = useMemo(() => {
    const list = currentSourceList.filter((p) => selectedIndices.includes(p.index));
    return list.length > 0 ? list : currentSourceList;
  }, [currentSourceList, selectedIndices]);

  const formatOptions = useMemo<SelectOption[]>(() => {
    return savedFormats.map((f) => ({
      value: f.id,
      label: `${f.name} (${f.targetWidth}×${f.targetHeight} · ${f.aspect || '1:1'})`,
    }));
  }, [savedFormats]);

  const currentFormat = useMemo(() => {
    const base =
      savedFormats.find((f) => f.id === selectedFormatId) ||
      savedFormats.find((f) => f.id === box.cropFormatId || f.id === box.templateId || f.id === box.watermarkPresetId) ||
      savedFormats.find((f) => box.templateText && f.name.toLowerCase() === box.templateText.toLowerCase()) ||
      savedFormats.find((f) => box.title && f.name && box.title.toLowerCase().includes(f.name.toLowerCase())) ||
      ((box.title?.toLowerCase().includes('fb') || box.templateText?.toLowerCase().includes('fb'))
        ? savedFormats.find((f) => f.name.toLowerCase().includes('fb'))
        : null) ||
      savedFormats[0];

    if (!base) return base;
    if (box.cropFormatId === selectedFormatId && box.watermarkConfig) {
      return {
        ...base,
        watermarkConfig: {
          ...(base.watermarkConfig || {}),
          ...box.watermarkConfig,
        },
      };
    }
    return base;
  }, [savedFormats, selectedFormatId, box.cropFormatId, box.templateId, box.watermarkPresetId, box.templateText, box.title, box.watermarkConfig]);

  // Live offscreen formatting for instant preview (supports standard crops, multi-tile grid cuts & watermarks)
  useEffect(() => {
    if (activePhotosToFormat.length === 0 || !currentFormat) {
      setFormattedPreviewItems([]);
      return;
    }
    let isCancelled = false;

    const generatePreviews = async () => {
      const items: Array<{
        id: string;
        sourcePhotoId: string;
        url: string;
        label: string;
        tileIndex: number;
        totalTiles: number;
        width: number;
        height: number;
        aspect: string;
      }> = [];
      const resultMap: Record<string, string> = {};

      for (const p of activePhotosToFormat) {
        try {
          const slices = await formatImageWithCropFormatSlices(p.url, currentFormat);
          if (isCancelled) return;
          if (slices && slices.length > 0) {
            slices.forEach((slice) => {
              const tileId = `${p.id}-tile-${slice.tileIndex}`;
              items.push({
                id: tileId,
                sourcePhotoId: p.id,
                url: slice.url,
                label: slices.length > 1 ? `${p.label} · ${slice.label}` : p.label,
                tileIndex: slice.tileIndex,
                totalTiles: slice.totalTiles,
                width: slice.width,
                height: slice.height,
                aspect: slice.aspect,
              });
              resultMap[tileId] = slice.url;
            });
            resultMap[p.id] = slices[0].url;
          } else {
            items.push({
              id: p.id,
              sourcePhotoId: p.id,
              url: p.url,
              label: p.label,
              tileIndex: 1,
              totalTiles: 1,
              width: currentFormat.targetWidth || 1200,
              height: currentFormat.targetHeight || 1200,
              aspect: currentFormat.aspect || '1:1',
            });
            resultMap[p.id] = p.url;
          }
        } catch {
          if (!isCancelled) {
            items.push({
              id: p.id,
              sourcePhotoId: p.id,
              url: p.url,
              label: p.label,
              tileIndex: 1,
              totalTiles: 1,
              width: currentFormat.targetWidth || 1200,
              height: currentFormat.targetHeight || 1200,
              aspect: currentFormat.aspect || '1:1',
            });
            resultMap[p.id] = p.url;
          }
        }
      }
      if (!isCancelled) {
        setFormattedPreviewItems(items);
        setLiveFormattedPhotos(resultMap);
      }
    };

    generatePreviews();
    return () => {
      isCancelled = true;
    };
  }, [
    activePhotosToFormat,
    currentFormat?.id,
    currentFormat?.targetWidth,
    currentFormat?.targetHeight,
    currentFormat?.aspect,
    currentFormat?.fitMode,
    currentFormat?.focusPosition,
    currentFormat?.mode,
    currentFormat?.gridLayoutId,
    JSON.stringify(currentFormat?.watermarkConfig),
  ]);

  const handleSelectFormat = (format: CropStudioFormat) => {
    setSelectedFormatId(format.id);
    const cleanName = format.name.replace(/^Format:\s*/i, '');
    setNodeTitle(cleanName);
    onUpdateBox(box.id, {
      title: cleanName,
      subtitle: 'Crop & Cut',
      cropFormatId: format.id,
      templateId: format.id,
      templateText: cleanName,
      watermarkPresetId: format.id,
      targetWidth: format.targetWidth,
      targetHeight: format.targetHeight,
      aspect: format.aspect,
      fitMode: format.fitMode,
      focusPosition: format.focusPosition,
      cropZoom: format.cropZoom,
      watermarkConfig: format.watermarkConfig,
    });
  };

  const handleTitleChange = (val: string) => {
    setNodeTitle(val);
    onUpdateBox(box.id, { title: val });
  };

  const handleSourceChange = (newSrc: 'get_images' | 'enhance' | 'generate' | 'all') => {
    setImageSource(newSrc);
    onUpdateBox(box.id, { imageSource: newSrc });
  };

  const sourceOptions: SelectOption[] = useMemo(() => {
    const getImagesCount = images?.length || 0;
    const enhanceCount = (enhancedPhotos && Object.keys(enhancedPhotos).length > 0)
      ? Object.keys(enhancedPhotos).length
      : getImagesCount;
    const heroCount = effectiveHeroImage ? 1 : 0;
    const totalCount = getImagesCount + heroCount;

    return [
      { value: 'get_images', label: `Get Images (${getImagesCount} ${getImagesCount === 1 ? 'Photo' : 'Photos'})` },
      { value: 'enhance', label: `Enhance Image (${enhanceCount} ${enhanceCount === 1 ? 'Photo' : 'Photos'})` },
      { value: 'generate', label: `Generate Image (${heroCount} ${heroCount === 1 ? 'Photo' : 'Photos'})` },
      { value: 'all', label: `All Photos (${totalCount} ${totalCount === 1 ? 'Photo' : 'Photos'})` },
    ];
  }, [images?.length, enhancedPhotos, effectiveHeroImage]);

  const photoOptions: SelectOption[] = useMemo(() => {
    if (currentSourceList.length === 0) {
      return [{ value: 'none', label: 'No photos available' }];
    }

    if (currentSourceList.length === 1) {
      return [
        {
          value: String(currentSourceList[0].index),
          label: `${currentSourceList[0].label} (Primary #1)`,
        },
      ];
    }

    const options: SelectOption[] = [
      { value: 'all', label: `All Photos from Source (${currentSourceList.length} photos)` },
      { value: 'first_only', label: 'Primary Photo Only (#1)' },
    ];

    const isCustom =
      selectedIndices.length > 1 &&
      selectedIndices.length < currentSourceList.length &&
      !(selectedIndices.length === 1 && selectedIndices[0] === currentSourceList[0]?.index);

    if (isCustom) {
      options.push({
        value: 'custom',
        label: `Selected Photos (${selectedIndices.length} picked)`,
      });
    }

    currentSourceList.forEach((p, idx) => {
      options.push({
        value: `photo-${p.index}`,
        label: `Photo #${idx + 1} (${p.label})`,
      });
    });

    return options;
  }, [currentSourceList, selectedIndices]);

  const currentPhotoSelectionValue = useMemo(() => {
    if (currentSourceList.length === 0) return 'none';
    if (currentSourceList.length === 1) return String(currentSourceList[0].index);

    if (selectedIndices.length === currentSourceList.length) {
      return 'all';
    }
    if (selectedIndices.length === 1 && selectedIndices[0] === currentSourceList[0]?.index) {
      return 'first_only';
    }
    if (selectedIndices.length === 1) {
      return `photo-${selectedIndices[0]}`;
    }
    return 'custom';
  }, [currentSourceList, selectedIndices]);

  const handlePhotoSelectionChange = (val: string) => {
    if (val === 'all') {
      const all = currentSourceList.map((p) => p.index);
      setSelectedIndices(all);
      onUpdateBox(box.id, { selectedImageIndices: all, imageSource });
    } else if (val === 'first_only') {
      const first = [currentSourceList[0]?.index || 1];
      setSelectedIndices(first);
      onUpdateBox(box.id, { selectedImageIndices: first, imageSource });
    } else if (val.startsWith('photo-')) {
      const photoIdx = parseInt(val.replace('photo-', ''), 10);
      if (!isNaN(photoIdx)) {
        setSelectedIndices([photoIdx]);
        onUpdateBox(box.id, { selectedImageIndices: [photoIdx], imageSource });
      }
    } else if (val !== 'none' && val !== 'custom') {
      const photoIdx = parseInt(val, 10);
      if (!isNaN(photoIdx)) {
        setSelectedIndices([photoIdx]);
        onUpdateBox(box.id, { selectedImageIndices: [photoIdx], imageSource });
      }
    }
  };

  const isGridFormat =
    currentFormat?.mode === 'grid' ||
    Boolean(currentFormat?.gridLayoutId) ||
    Boolean(currentFormat?.description?.toLowerCase().includes('tile')) ||
    Boolean(currentFormat?.name?.toLowerCase().includes('cut'));

  const displayPreviewItems = useMemo(() => {
    if (formattedPreviewItems.length > 0) return formattedPreviewItems;
    return activePhotosToFormat.map((p, idx) => ({
      id: p.id,
      sourcePhotoId: p.id,
      url: liveFormattedPhotos[p.id] || p.url,
      label: p.label,
      tileIndex: idx + 1,
      totalTiles: 1,
      width: currentFormat?.targetWidth || 1200,
      height: currentFormat?.targetHeight || 1200,
      aspect: currentFormat?.aspect || '1:1',
    }));
  }, [formattedPreviewItems, activePhotosToFormat, liveFormattedPhotos, currentFormat]);

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

      {/* ── Image Source & Photo Selection Card (Clean Dropdown Style) ── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          padding: '12px 14px',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          backgroundColor: isDark ? 'var(--bg-surface)' : 'var(--bg-main)',
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

        {/* 2. Photo Selection Dropdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Select Photo to Crop
          </label>
          <Select
            options={photoOptions}
            value={currentPhotoSelectionValue}
            onChange={(val) => handlePhotoSelectionChange(val)}
            height="36px"
            placeholder="Select photo(s)..."
          />
        </div>
      </div>

      {/* Processed Photos Live Preview */}
      {displayPreviewItems.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginTop: '0.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Processed Photos Preview
            </label>
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                color: box.enabled === false ? 'var(--text-muted)' : '#10B981',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              {box.enabled === false
                ? '⏸️ Bypassed (Disabled in workflow)'
                : `✓ ${displayPreviewItems.length} ${isGridFormat && displayPreviewItems.length > 1 ? 'Tiles' : 'Photos'} Ready · ${currentFormat?.aspect || '1:1'}`}
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: displayPreviewItems.length === 2 ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
              gap: '8px',
              maxHeight: '340px',
              overflowY: 'auto',
              padding: '6px',
              borderRadius: '8px',
              border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
              backgroundColor: isDark ? '#0D1117' : '#F8FAFC',
              opacity: box.enabled === false ? 0.45 : 1,
              filter: box.enabled === false ? 'grayscale(0.85)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            {displayPreviewItems.map((item, idx) => {
              const isSelected = selectedPhotoIndex === idx;

              const cardPaddingTop =
                item.width && item.height
                  ? `${(item.height / item.width) * 100}%`
                  : currentFormat?.aspect === '4:5'
                  ? '125%'
                  : currentFormat?.aspect === '16:9'
                  ? '56.25%'
                  : currentFormat?.aspect === '9:16'
                  ? '177.7%'
                  : '100%';

              return (
                <div
                  key={`crop-preview-${item.id}`}
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
                  title={`Click to view ${item.label} full size`}
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
                      src={item.url}
                      alt={item.label}
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

                    {/* Photo or Tile Number Badge */}
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
                      {item.totalTiles > 1 ? `Tile #${item.tileIndex}` : `#${idx + 1}`}
                    </div>

                    {/* Multi-Tile Fraction Badge (e.g. 1/2 or 2/2) */}
                    {item.totalTiles > 1 && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '3px',
                          right: '3px',
                          fontSize: '0.5rem',
                          fontWeight: 700,
                          padding: '1px 4px',
                          borderRadius: '3px',
                          backgroundColor: 'rgba(16, 185, 129, 0.9)',
                          color: '#FFFFFF',
                          pointerEvents: 'none',
                        }}
                      >
                        {item.tileIndex}/{item.totalTiles}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              Click any photo to select &amp; view full size
            </span>
          </div>
        </div>
      )}

      {/* Fullscreen Photo Lightbox Modal */}
      {displayPreviewItems.length > 0 && lightboxIndex !== null && (
        <PhotoLightboxModal
          isOpen={lightboxIndex !== null}
          onClose={() => setLightboxIndex(null)}
          initialIndex={lightboxIndex}
          photos={displayPreviewItems.map((p, idx) => ({
            index: idx,
            url: p.url,
            name: p.label,
          }))}
          title={nodeTitle || 'Crop & Cut'}
          formatSubtitle={`${currentFormat?.name || 'Crop Preset'} · ${currentFormat?.targetWidth || 1200}×${currentFormat?.targetHeight || 1200} (${currentFormat?.aspect || '1:1'})`}
        />
      )}
    </div>
  );
};
