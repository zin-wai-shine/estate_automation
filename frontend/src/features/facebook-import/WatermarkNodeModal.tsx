import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  FiEdit2,
  FiMaximize2,
  FiCheck,
  FiX,
  FiImage,
  FiSettings,
  FiDownload,
  FiFolderPlus,
  FiArchive,
  FiChevronUp,
  FiChevronDown,
} from 'react-icons/fi';
import JSZip from 'jszip';
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
import type { DynamicAIBoxConfig, WorkflowWireConnection } from './FacebookWorkflowCanvas';
import { Select, type SelectOption } from '../../components/ui/Select';
import { PhotoLightboxModal } from './PhotoLightboxModal';
import { fetchEnhancedDownloadedImages } from '../browser-processing/browserAutomationService';

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
  workflowBoxes?: DynamicAIBoxConfig[];
  connections?: WorkflowWireConnection[];
  listingCode?: string;
  onOpenSettingsSidebox?: () => void;
  isSettingsSideboxOpen?: boolean;
}

export const WatermarkNodeModal: React.FC<WatermarkNodeModalProps> = ({
  box,
  isDark,
  onUpdateBox,
  images,
  watermarkedPhotos,
  enhancedPhotos,
  heroImage,
  onOpenLightbox: _onOpenLightbox,
  workflowBoxes,
  connections: _connections,
  listingCode,
  onOpenSettingsSidebox,
  isSettingsSideboxOpen: _isSettingsSideboxOpen,
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

  // Storage & Download state
  const [isDownloadDropdownOpen, setIsDownloadDropdownOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const downloadDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (downloadDropdownRef.current && !downloadDropdownRef.current.contains(e.target as Node)) {
        setIsDownloadDropdownOpen(false);
      }
    };
    if (isDownloadDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDownloadDropdownOpen]);

  const configuredFolder = box.downloadFolder || localStorage.getItem('ea_crop_download_folder') || '/Downloads';
  const displayFolderName = configuredFolder.replace(/^\//, '').trim() ? configuredFolder.replace(/^\//, '').replace(/\/$/, '') : 'Downloads';
  const cleanBoxName = (nodeTitle || box.title || 'Photo-Format').replace(/^Format:\s*/i, '').replace(/[\/\\?%*:|"<>]/g, '').trim();

  const fetchBlobFromUrl = async (url: string): Promise<Blob> => {
    if (url.startsWith('data:')) {
      const commaIdx = url.indexOf(',');
      const header = url.slice(0, commaIdx);
      const base64Data = url.slice(commaIdx + 1);
      const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
      const binaryStr = atob(base64Data);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      return new Blob([bytes], { type: mimeType });
    } else {
      const fullUrl = url.startsWith('/storage') ? `http://localhost:8085${url}` : url;
      const response = await fetch(fullUrl, { mode: 'cors' });
      return await response.blob();
    }
  };

  const downloadFileFromUrl = async (url: string, filename: string) => {
    try {
      const blob = await fetchBlobFromUrl(url);
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => {
        try { URL.revokeObjectURL(blobUrl); } catch (_) {}
      }, 30000);
    } catch (err) {
      console.warn('downloadFileFromUrl direct fallback:', err);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleDownloadSinglePhoto = async (item: any, index: number, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const fileNum = item.tileIndex ? `tile-${item.tileIndex}` : `${index + 1}`;
    const ext = (item.url.includes('image/png') || item.url.includes('.png')) ? 'png' : (item.url.includes('image/webp') || item.url.includes('.webp')) ? 'webp' : 'jpg';
    const fileName = `${cleanBoxName}-${fileNum}.${ext}`;
    await downloadFileFromUrl(item.url, fileName);
  };

  const handleDownloadDirectly = async () => {
    setIsDownloadDropdownOpen(false);
    if (displayPreviewItems.length === 0) return;
    setIsDownloading(true);
    try {
      for (let i = 0; i < displayPreviewItems.length; i++) {
        const item = displayPreviewItems[i];
        const fileNum = item.tileIndex ? `tile-${item.tileIndex}` : `${i + 1}`;
        const ext = (item.url.includes('image/png') || item.url.includes('.png')) ? 'png' : (item.url.includes('image/webp') || item.url.includes('.webp')) ? 'webp' : 'jpg';
        const fileName = `${cleanBoxName}-${fileNum}.${ext}`;
        await downloadFileFromUrl(item.url, fileName);
        if (i < displayPreviewItems.length - 1) {
          await new Promise((r) => setTimeout(r, 250));
        }
      }
    } catch (err) {
      console.error('Direct download error:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadWithFolder = async () => {
    setIsDownloadDropdownOpen(false);
    if (displayPreviewItems.length === 0) return;
    setIsDownloading(true);

    try {
      const payloadFiles = displayPreviewItems.map((item, i) => {
        const fileNum = item.tileIndex ? `tile-${item.tileIndex}` : `${i + 1}`;
        const ext = (item.url.includes('image/png') || item.url.includes('.png')) ? 'png' : (item.url.includes('image/webp') || item.url.includes('.webp')) ? 'webp' : 'jpg';
        return {
          filename: `${cleanBoxName}-${fileNum}.${ext}`,
          data: item.url,
        };
      });

      // 1. Try native Mac Companion service (directly writes to ~/Downloads on host Mac without prompts)
      try {
        const res = await fetch('http://localhost:9224/save-to-folder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target_directory: configuredFolder,
            folder_name: cleanBoxName,
            files: payloadFiles,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.saved_count > 0) {
            setIsDownloading(false);
            return;
          }
        }
      } catch (compErr) {
        console.warn('Mac companion save-to-folder error:', compErr);
      }

      // 2. Try Go backend service fallback
      try {
        const res = await fetch('http://localhost:8085/api/facebook-import/save-to-folder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target_directory: configuredFolder,
            folder_name: cleanBoxName,
            files: payloadFiles,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.saved_count > 0) {
            setIsDownloading(false);
            return;
          }
        }
      } catch (backendErr) {
        console.warn('Backend save-to-folder error:', backendErr);
      }
    } catch (err) {
      console.warn('Backend save-to-folder error, falling back to ZIP:', err);
    }

    await handleDownloadZipWithFolders();
  };

  const handleDownloadZipWithFolders = async () => {
    setIsDownloadDropdownOpen(false);
    if (displayPreviewItems.length === 0) return;
    setIsDownloading(true);

    try {
      const zip = new JSZip();
      const folder = zip.folder(cleanBoxName);

      for (let i = 0; i < displayPreviewItems.length; i++) {
        const item = displayPreviewItems[i];
        const fileNum = item.tileIndex ? `tile-${item.tileIndex}` : `${i + 1}`;
        const ext = (item.url.includes('image/png') || item.url.includes('.png')) ? 'png' : (item.url.includes('image/webp') || item.url.includes('.webp')) ? 'webp' : 'jpg';
        const fileName = `${cleanBoxName}-${fileNum}.${ext}`;

        const blob = await fetchBlobFromUrl(item.url);
        if (folder) {
          folder.file(fileName, blob);
        } else {
          zip.file(`${cleanBoxName}/${fileName}`, blob);
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const blobUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${cleanBoxName}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => {
        try { URL.revokeObjectURL(blobUrl); } catch (_) {}
      }, 30000);
    } catch (err) {
      console.error('Failed to create ZIP:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  // Image Source Selection: 'get_images' | 'enhance' | 'generate' | 'all'
  const [imageSource, setImageSource] = useState<'get_images' | 'enhance' | 'generate' | 'all'>(
    (box.imageSource as any) || 'get_images'
  );

  // Effective images extracted from workflow run
  const effectiveImageList = useMemo(() => {
    if (images && images.length > 0) return images;
    return [];
  }, [images]);

  // Dynamically resolve Hero / Generator node title from workflow boxes
  const heroNode = useMemo(() => {
    return workflowBoxes?.find(
      (b) =>
        b.title?.toLowerCase().includes('hero') ||
        b.browserGroupName?.toLowerCase().includes('hero') ||
        b.tabGroupMode === 'generate' ||
        b.processKind === 'generate_image'
    );
  }, [workflowBoxes]);

  const heroLabel = useMemo(() => {
    if (heroNode) {
      return (heroNode.browserGroupName || heroNode.title || 'BG Hero Generator').trim();
    }
    return 'BG Hero Generator';
  }, [heroNode]);

  // Dynamically resolve Enhance node title from workflow boxes
  const enhanceNode = useMemo(() => {
    return workflowBoxes?.find(
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

  // Fallback hero image from localStorage or referenceImage or primary image
  const effectiveHeroImage = useMemo(() => {
    if (heroImage && heroImage.url) return heroImage;
    try {
      const saved = localStorage.getItem('bolthaven_last_hero_image');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    if (box.referenceImage) {
      return { url: box.referenceImage, fileName: 'hero_reference.png' };
    }
    if (effectiveImageList.length > 0) {
      const first = effectiveImageList[0];
      const url = first.stored_url || first.source_url;
      if (url) return { url, fileName: 'hero_sample.png' };
    }
    return null;
  }, [heroImage, box.referenceImage, effectiveImageList]);

  // Live downloaded enhanced photos polled from companion / backend (persisted across drive deletions)
  const [companionEnhanced, setCompanionEnhanced] = useState<Record<number, string>>(() => {
    try {
      const codeKey = listingCode || 'current';
      const saved = localStorage.getItem(`bolthaven_canvas_enhanced_${codeKey}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  useEffect(() => {
    if (!effectiveImageList || effectiveImageList.length === 0) {
      return;
    }
    let isCancelled = false;
    const loadDownloaded = async () => {
      try {
        const downloaded = await fetchEnhancedDownloadedImages(undefined, listingCode);
        if (downloaded && downloaded.length > 0 && !isCancelled) {
          const valid = downloaded.filter((img) => (img.position || 1) <= effectiveImageList.length);
          const map: Record<number, string> = {};
          valid.forEach((img) => {
            const pos = img.position || 1;
            const pos0 = pos - 1; // 0-based index key
            map[pos0] = img.backend_url || img.url;
          });
          setCompanionEnhanced((prev) => {
            let hasChange = false;
            for (const [k, v] of Object.entries(map)) {
              if (prev[Number(k)] !== v) {
                hasChange = true;
                break;
              }
            }
            if (!hasChange && Object.keys(map).length === Object.keys(prev).length) {
              return prev;
            }
            const next = { ...prev, ...map };
            try {
              const codeKey = listingCode || 'current';
              localStorage.setItem(`bolthaven_canvas_enhanced_${codeKey}`, JSON.stringify(next));
            } catch {}
            return next;
          });
        }
      } catch (e) {}
    };
    // Load once when clicking this box / when modal opens
    loadDownloaded();
    return () => {
      isCancelled = true;
    };
  }, [box.id, listingCode]);

  const mergedEnhancedPhotos = useMemo(() => {
    return { ...companionEnhanced, ...(enhancedPhotos || {}) };
  }, [companionEnhanced, enhancedPhotos]);

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

    // 1. Get Images (Raw extracted or fallback studio images)
    if (imageSource === 'get_images' || imageSource === 'all') {
      if (effectiveImageList && effectiveImageList.length > 0) {
        effectiveImageList.forEach((img, idx) => {
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
    }

    // 2. Enhanced Images
    if (imageSource === 'enhance' || imageSource === 'all') {
      const hasEnhanced = Object.keys(mergedEnhancedPhotos).length > 0;
      if (imageSource === 'enhance') {
        if (effectiveImageList && effectiveImageList.length > 0) {
          effectiveImageList.forEach((img, idx) => {
            const photoNum = idx + 1;
            // Use strictly 0-based index key (idx) to match companion mapping
            const enhUrl = mergedEnhancedPhotos[idx];

            const fallbackUrl = img.stored_url
              ? (img.stored_url.startsWith('http') ? img.stored_url : `http://localhost:8085${img.stored_url}`)
              : img.source_url;

            rawList.push({
              id: `enh-${photoNum}`,
              index: photoNum,
              displayNumber: photoNum,
              url: enhUrl || fallbackUrl,
              source: 'enhance',
              label: enhUrl ? `Enhanced #${photoNum}` : `Photo #${photoNum} (Enhance Source)`,
              isEnhanced: Boolean(enhUrl),
            });
          });

          // Add any extra enhanced photos beyond effectiveImageList
          Object.entries(mergedEnhancedPhotos).forEach(([k, enhUrl]) => {
            const num = Number(k) + 1;
            if (!rawList.some((r) => r.index === num || r.displayNumber === num)) {
              rawList.push({
                id: `enh-${num}`,
                index: num,
                displayNumber: num,
                url: enhUrl,
                source: 'enhance',
                label: `Enhanced #${num}`,
                isEnhanced: true,
              });
            }
          });
        } else if (hasEnhanced) {
          Object.entries(mergedEnhancedPhotos).forEach(([k, enhUrl]) => {
            const num = Number(k) + 1;
            rawList.push({
              id: `enh-${num}`,
              index: num,
              displayNumber: num,
              url: enhUrl,
              source: 'enhance',
              label: `Enhanced #${num}`,
              isEnhanced: true,
            });
          });
        }
      } else {
        // imageSource === 'all'
        if (hasEnhanced) {
          Object.entries(mergedEnhancedPhotos).forEach(([k, url]) => {
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

    // 3. Generate Image (Hero generator: BG Hero Generator / FB Hero)
    if (imageSource === 'generate' || imageSource === 'all') {
      if (effectiveHeroImage && effectiveHeroImage.url) {
        rawList.push({
          id: 'hero-1',
          index: imageSource === 'generate' ? 1 : 999,
          displayNumber: 1,
          url: effectiveHeroImage.url,
          source: 'generate',
          label: effectiveHeroImage.condoName ? `${effectiveHeroImage.condoName} Hero` : `${heroLabel} #1`,
        });
      } else if (imageSource === 'generate') {
        const firstRaw = effectiveImageList?.[0];
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
            label: `${heroLabel} Target Photo #1`,
          });
        }
      }
    }

    return rawList;
  }, [imageSource, effectiveImageList, mergedEnhancedPhotos, effectiveHeroImage, heroLabel, watermarkedPhotos]);

  const [selectedIndices, setSelectedIndices] = useState<number[]>(() => {
    if (Array.isArray(box.selectedImageIndices) && box.selectedImageIndices.length > 0) {
      return box.selectedImageIndices;
    }
    return [];
  });

  // Synchronize selection indices with current source list
  useEffect(() => {
    if (currentSourceList.length > 0) {
      const isCustomExplicit = (box as any).isCustomPicked === true;
      const shouldSelectAll =
        selectedIndices.length === 0 ||
        !isCustomExplicit ||
        !selectedIndices.some((idx) => currentSourceList.some((p) => p.index === idx));

      if (shouldSelectAll && selectedIndices.length !== currentSourceList.length) {
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

  const lastRenderedKeyRef = useRef<string>('');

  // Live offscreen formatting for instant preview (supports standard crops, multi-tile grid cuts & watermarks)
  useEffect(() => {
    if (activePhotosToFormat.length === 0 || !currentFormat) {
      setFormattedPreviewItems([]);
      lastRenderedKeyRef.current = '';
      return;
    }

    const currentKey = `${activePhotosToFormat.map((p) => `${p.id}:${p.url}`).join('|')}__${currentFormat.id}_${currentFormat.targetWidth}_${currentFormat.targetHeight}_${currentFormat.aspect}_${currentFormat.mode}_${currentFormat.gridLayoutId}_${JSON.stringify(currentFormat.watermarkConfig || {})}`;
    if (lastRenderedKeyRef.current === currentKey) {
      return; // Already rendered this exact configuration, do NOT re-render or flash!
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
        lastRenderedKeyRef.current = currentKey;
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
    const getImagesCount = effectiveImageList.length;
    const enhanceCount = Math.max(Object.keys(mergedEnhancedPhotos).length, getImagesCount);
    const heroCount = effectiveHeroImage ? 1 : (effectiveImageList.length > 0 ? 1 : 0);
    const totalCount = getImagesCount + (effectiveHeroImage ? 1 : 0);

    return [
      { value: 'get_images', label: `Get Images (${getImagesCount} ${getImagesCount === 1 ? 'Photo' : 'Photos'})` },
      { value: 'enhance', label: `${enhanceLabel} (${enhanceCount} ${enhanceCount === 1 ? 'Photo' : 'Photos'})` },
      { value: 'generate', label: `${heroLabel} (${heroCount} ${heroCount === 1 ? 'Photo' : 'Photos'})` },
      { value: 'all', label: `All Photos (${totalCount} ${totalCount === 1 ? 'Photo' : 'Photos'})` },
    ];
  }, [effectiveImageList.length, mergedEnhancedPhotos, effectiveHeroImage, heroLabel, enhanceLabel]);

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
      {/* Active Format & Image Source Overview Card with Settings Shortcut */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderRadius: '10px',
          border: '1px solid var(--border-color)',
          backgroundColor: isDark ? 'var(--bg-surface)' : '#F8FAFC',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
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
            {currentFormat?.aspect || '1:1'}
          </span>

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {currentFormat?.name || 'Crop Format'}
            </div>
            <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {currentFormat?.targetWidth} × {currentFormat?.targetHeight} px • Source: {imageSource === 'generate' ? `${heroLabel} (1 Photo)` : imageSource === 'enhance' ? `${enhanceLabel} (${activePhotosToFormat.length} Photos)` : `Get Images (${activePhotosToFormat.length} Photos)`}
            </div>
          </div>
        </div>

        {onOpenSettingsSidebox && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onOpenSettingsSidebox();
            }}
            title="Configure Crop Format & Source in Settings"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 9px',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#FFFFFF',
              color: 'var(--text-secondary)',
              fontSize: '0.6875rem',
              fontWeight: 500,
              cursor: 'pointer',
              flexShrink: 0,
              pointerEvents: 'auto',
              userSelect: 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <FiSettings size={12} style={{ pointerEvents: 'none' }} />
            <span style={{ pointerEvents: 'none' }}>Settings</span>
          </button>
        )}
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
                    setLightboxIndex(idx);
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
                    {/* Hover Overlay with Download & Maximize Icons */}
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.4)',
                        opacity: 0,
                        transition: 'opacity 0.15s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        color: '#FFFFFF',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = '1';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = '0';
                      }}
                    >
                      <button
                        type="button"
                        onClick={(e) => handleDownloadSinglePhoto(item, idx, e)}
                        title={`Download ${item.label || `Photo #${idx + 1}`}`}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          backgroundColor: 'rgba(0, 0, 0, 0.75)',
                          border: '1px solid rgba(255, 255, 255, 0.35)',
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'transform 0.15s ease, background-color 0.15s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.9)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.75)')}
                      >
                        <FiDownload size={13} />
                      </button>

                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          backgroundColor: 'rgba(0, 0, 0, 0.75)',
                          border: '1px solid rgba(255, 255, 255, 0.35)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title="Click to view full size"
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

          {/* Download All Button with Dropdown (Sleek Studio Design) */}
          <div ref={downloadDropdownRef} style={{ position: 'relative', marginTop: '4px' }}>
            <button
              type="button"
              disabled={isDownloading}
              onClick={() => setIsDownloadDropdownOpen((prev) => !prev)}
              style={{
                width: '100%',
                height: '32px',
                padding: '0 12px',
                borderRadius: '6px',
                border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                color: 'var(--text-secondary)',
                fontSize: '0.75rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: isDownloading ? 'wait' : 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(0, 0, 0, 0.08)';
                e.currentTarget.style.borderColor = isDark ? '#484F58' : '#CBD5E1';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
                e.currentTarget.style.borderColor = isDark ? '#30363D' : '#E2E8F0';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              <FiDownload size={12} />
              <span>
                {isDownloading
                  ? 'Downloading...'
                  : `Download All (${displayPreviewItems.length} ${isGridFormat && displayPreviewItems.length > 1 ? 'Tiles' : 'Photos'})`}
              </span>
              {isDownloadDropdownOpen ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />}
            </button>

            {/* Dropdown Popover (Opens downward, clean compact design) */}
            {isDownloadDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '4px',
                  borderRadius: '8px',
                  border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                  backgroundColor: isDark ? '#161B22' : '#FFFFFF',
                  boxShadow: isDark
                    ? '0 10px 25px rgba(0, 0, 0, 0.6), 0 2px 6px rgba(0, 0, 0, 0.4)'
                    : '0 8px 20px rgba(0, 0, 0, 0.12)',
                  padding: '4px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  zIndex: 100,
                }}
              >
                {/* 1. Directly to Downloads Folder */}
                <div
                  onClick={handleDownloadDirectly}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.04)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                      border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <FiDownload size={14} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{ fontSize: '0.78125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Directly to {displayFolderName} Folder
                    </span>
                    <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                      Save all {displayPreviewItems.length} photos directly
                    </span>
                  </div>
                </div>

                {/* 2. Create Folders in Downloads */}
                <div
                  onClick={handleDownloadWithFolder}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.04)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                      border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <FiFolderPlus size={14} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{ fontSize: '0.78125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Create Folders in {displayFolderName}
                    </span>
                    <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                      Creates folder /{cleanBoxName}/ with relative photos
                    </span>
                  </div>
                </div>

                {/* 3. Download ZIP with Folders */}
                <div
                  onClick={handleDownloadZipWithFolders}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.04)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                      border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <FiArchive size={14} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{ fontSize: '0.78125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Download ZIP with Folders
                    </span>
                    <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                      Bundle in {cleanBoxName}.zip with folder structure
                    </span>
                  </div>
                </div>
              </div>
            )}
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
            width: p.width,
            height: p.height,
          }))}
          title={nodeTitle || 'Crop & Cut'}
          formatSubtitle={(() => {
            const currentItem = displayPreviewItems[lightboxIndex];
            const sizeStr = currentItem?.width && currentItem?.height
              ? `${currentItem.width}×${currentItem.height}`
              : (currentFormat ? `${currentFormat.targetWidth || 1200}×${currentFormat.targetHeight || 1200}` : '');
            const aspectStr = currentItem?.aspect || currentFormat?.aspect || '1:1';
            return `${currentFormat?.name || 'Crop Preset'}${sizeStr ? ` · ${sizeStr}` : ''}${aspectStr ? ` (${aspectStr})` : ''}`;
          })()}
          listingCode={listingCode}
        />
      )}
    </div>
  );
};
