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
  FiUploadCloud,
  FiUpload,
  FiTrash2,
  FiRefreshCw,
  FiClock,
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
  clearCropSlicesCache,
  getCachedCropSlices,
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
  connections,
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
    const photoNum = typeof (item as any).photoIndex === 'number' ? (item as any).photoIndex + 1 : index + 1;
    const tileSuffix = item.totalTiles && item.totalTiles > 1 ? `-tile-${item.tileIndex || 1}` : '';
    const ext = (item.url.includes('image/png') || item.url.includes('.png')) ? 'png' : (item.url.includes('image/webp') || item.url.includes('.webp')) ? 'webp' : 'jpg';
    const fileName = `${cleanBoxName}-${photoNum}${tileSuffix}.${ext}`;
    await downloadFileFromUrl(item.url, fileName);
  };

  const handleDownloadDirectly = async () => {
    setIsDownloadDropdownOpen(false);
    if (displayPreviewItems.length === 0) return;
    setIsDownloading(true);
    try {
      const seenDirectNames = new Set<string>();
      for (let i = 0; i < displayPreviewItems.length; i++) {
        const item = displayPreviewItems[i];
        const photoNum = typeof (item as any).photoIndex === 'number' ? (item as any).photoIndex + 1 : i + 1;
        const tileSuffix = item.totalTiles && item.totalTiles > 1 ? `-tile-${item.tileIndex || 1}` : '';
        const ext = (item.url.includes('image/png') || item.url.includes('.png')) ? 'png' : (item.url.includes('image/webp') || item.url.includes('.webp')) ? 'webp' : 'jpg';
        let fileName = `${cleanBoxName}-${photoNum}${tileSuffix}.${ext}`;
        if (seenDirectNames.has(fileName)) {
          fileName = `${cleanBoxName}-${photoNum}-${i + 1}${tileSuffix}.${ext}`;
        }
        seenDirectNames.add(fileName);
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
      // Convert all preview item URLs (including browser blob: URLs) to genuine base64 data URLs
      const seenFolderNames = new Set<string>();
      const payloadFiles = await Promise.all(
        displayPreviewItems.map(async (item, i) => {
          const photoNum = typeof (item as any).photoIndex === 'number' ? (item as any).photoIndex + 1 : i + 1;
          const tileSuffix = item.totalTiles && item.totalTiles > 1 ? `-tile-${item.tileIndex || 1}` : '';
          const ext = (item.url.includes('image/png') || item.url.includes('.png')) ? 'png' : (item.url.includes('image/webp') || item.url.includes('.webp')) ? 'webp' : 'jpg';
          let filename = `${cleanBoxName}-${photoNum}${tileSuffix}.${ext}`;
          if (seenFolderNames.has(filename)) {
            filename = `${cleanBoxName}-${photoNum}-${i + 1}${tileSuffix}.${ext}`;
          }
          seenFolderNames.add(filename);

          let base64Data = item.url;
          if (item.url.startsWith('blob:') || item.url.startsWith('/storage') || item.url.startsWith('http')) {
            try {
              const blob = await fetchBlobFromUrl(item.url);
              base64Data = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = () => resolve(item.url);
                reader.readAsDataURL(blob);
              });
            } catch (convErr) {
              console.warn('Error converting item to base64 for folder save:', convErr);
            }
          }

          return {
            filename,
            data: base64Data,
          };
        })
      );

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
      const seenZipNames = new Set<string>();

      for (let i = 0; i < displayPreviewItems.length; i++) {
        const item = displayPreviewItems[i];
        const photoNum = typeof (item as any).photoIndex === 'number' ? (item as any).photoIndex + 1 : i + 1;
        const tileSuffix = item.totalTiles && item.totalTiles > 1 ? `-tile-${item.tileIndex || 1}` : '';
        const ext = (item.url.includes('image/png') || item.url.includes('.png')) ? 'png' : (item.url.includes('image/webp') || item.url.includes('.webp')) ? 'webp' : 'jpg';
        let fileName = `${cleanBoxName}-${photoNum}${tileSuffix}.${ext}`;
        if (seenZipNames.has(fileName)) {
          fileName = `${cleanBoxName}-${photoNum}-${i + 1}${tileSuffix}.${ext}`;
        }
        seenZipNames.add(fileName);

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

  // Helper to ensure an image belongs to the active listing code
  const isImageMatchingListing = (fileName?: string, code?: string) => {
    if (!code || !code.trim()) return true;
    if (!fileName) return false;
    const cleanCode = code.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanFile = fileName.toLowerCase().replace(/[^a-z0-9]/g, '');
    return cleanFile.includes(cleanCode);
  };

  // Dynamically resolve Hero / Generator node title from workflow boxes (prefer direct incoming connection, then matching node)
  const connectedUpstreamHero = useMemo(() => {
    const incoming = (connections || []).filter((c) => c.toNodeId === box.id);
    for (const conn of incoming) {
      const upBox = (workflowBoxes || []).find((b: any) => b.id === conn.fromNodeId);
      if (
        upBox &&
        (upBox.tabGroupMode === 'generate' ||
          upBox.processKind === 'generate_image' ||
          upBox.title?.toLowerCase().includes('hero') ||
          upBox.browserGroupName?.toLowerCase().includes('hero'))
      ) {
        return upBox;
      }
    }
    return null;
  }, [connections, box.id, workflowBoxes]);

  const heroNode = useMemo(() => {
    if (connectedUpstreamHero) return connectedUpstreamHero;
    if (box.imageSource && box.imageSource.startsWith('node:')) {
      const targetId = box.imageSource.replace('node:', '');
      const found = (workflowBoxes || []).find((b) => b.id === targetId);
      if (
        found &&
        (found.tabGroupMode === 'generate' ||
          found.processKind === 'generate_image' ||
          found.title?.toLowerCase().includes('hero') ||
          found.browserGroupName?.toLowerCase().includes('hero'))
      ) {
        return found;
      }
    }
    return workflowBoxes?.find(
      (b) =>
        b.title?.toLowerCase().includes('hero') ||
        b.browserGroupName?.toLowerCase().includes('hero') ||
        b.tabGroupMode === 'generate' ||
        b.processKind === 'generate_image'
    );
  }, [connectedUpstreamHero, box.imageSource, workflowBoxes]);

  const heroLabel = useMemo(() => {
    if (heroNode) {
      return (heroNode.title || heroNode.browserGroupName || 'FB Hero').trim();
    }
    return 'FB Hero';
  }, [heroNode]);

  // Dynamically resolve Enhance node title from workflow boxes
  const connectedUpstreamEnhance = useMemo(() => {
    const incoming = (connections || []).filter((c) => c.toNodeId === box.id);
    for (const conn of incoming) {
      const upBox = (workflowBoxes || []).find((b: any) => b.id === conn.fromNodeId);
      if (
        upBox &&
        (upBox.tabGroupMode === 'enhance' ||
          upBox.processKind === 'enhance_images' ||
          upBox.title?.toLowerCase().includes('enhance') ||
          upBox.browserGroupName?.toLowerCase().includes('enhance'))
      ) {
        return upBox;
      }
    }
    return null;
  }, [connections, box.id, workflowBoxes]);

  const enhanceNode = useMemo(() => {
    if (connectedUpstreamEnhance) return connectedUpstreamEnhance;
    if (box.imageSource && box.imageSource.startsWith('node:')) {
      const targetId = box.imageSource.replace('node:', '');
      const found = (workflowBoxes || []).find((b) => b.id === targetId);
      if (
        found &&
        (found.tabGroupMode === 'enhance' ||
          found.processKind === 'enhance_images' ||
          found.title?.toLowerCase().includes('enhance') ||
          found.browserGroupName?.toLowerCase().includes('enhance'))
      ) {
        return found;
      }
    }
    return workflowBoxes?.find(
      (b) =>
        (b.title?.toLowerCase().includes('enhance') ||
         b.browserGroupName?.toLowerCase().includes('enhance') ||
         b.tabGroupMode === 'enhance') &&
        b.id !== box.id
    );
  }, [connectedUpstreamEnhance, box.imageSource, workflowBoxes, box.id]);

  const enhanceLabel = useMemo(() => {
    if (enhanceNode) {
      return (enhanceNode.title || enhanceNode.browserGroupName || 'Enhance Image').trim();
    }
    return 'Enhance Image';
  }, [enhanceNode]);

  // Detect if this crop box is configured or wired for FB Hero
  const isHeroCropNode = useMemo(() => {
    // If user explicitly chose another image source in the dropdown, respect their selection!
    if (box.imageSource && box.imageSource !== 'generate' && !box.imageSource.includes('hero')) {
      if (box.imageSource.startsWith('node:')) {
        const targetId = box.imageSource.replace('node:', '');
        const target = (workflowBoxes || []).find((b: any) => b.id === targetId);
        if (target) {
          const t = (target.title || '').toLowerCase();
          const g = (target.browserGroupName || '').toLowerCase();
          if (target.tabGroupMode === 'generate' || target.processKind === 'generate_image' || t.includes('hero') || g.includes('hero')) {
            return true;
          }
        }
      }
      return false;
    }

    const boxTitle = (box.title || '').toLowerCase();
    const template = (box.templateText || '').toLowerCase();
    const source = box.imageSource;
    const cropFmtId = (box.cropFormatId || box.templateId || '').toLowerCase();
    const formatName = (currentFormat?.name || '').toLowerCase();
    const currentFmtId = (currentFormat?.id || '').toLowerCase();

    const matchesHero =
      source === 'generate' ||
      (typeof source === 'string' && source.includes('hero')) ||
      boxTitle.includes('hero') ||
      template.includes('hero') ||
      cropFmtId.includes('hero') ||
      cropFmtId === 'format-grid-2split' ||
      formatName.includes('hero') ||
      currentFmtId === 'format-grid-2split';

    if (matchesHero) return true;

    return (connections || []).some((c: any) => {
      if (c.toNodeId !== box.id) return false;
      if (c.fromNodeId === 'get-images' || c.fromNodeId === 'get-content') return false;
      const upBox = (workflowBoxes || []).find((b: any) => b.id === c.fromNodeId);
      if (!upBox) return false;
      const t = (upBox.title || '').toLowerCase();
      const g = (upBox.browserGroupName || '').toLowerCase();
      return (
        upBox.tabGroupMode === 'generate' ||
        upBox.processKind === 'generate_image' ||
        t.includes('hero') ||
        g.includes('hero')
      );
    });
  }, [box.title, box.templateText, box.imageSource, box.cropFormatId, box.templateId, currentFormat, connections, workflowBoxes, box.id]);

  // Live hero image from prop, localStorage or event
  const [liveHeroImage, setLiveHeroImage] = useState<{ url: string; fileName?: string; condoName?: string } | null>(() => {
    if (heroImage && heroImage.url) {
      if (!listingCode || isImageMatchingListing(heroImage.fileName, listingCode)) {
        return heroImage;
      }
    }
    try {
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('bolthaven_last_hero_image') : null;
      if (saved) {
        const parsed = JSON.parse(saved);
        const fname = (parsed?.fileName || '').toLowerCase();
        if (parsed?.url && fname.includes('hero')) {
          if (!listingCode || isImageMatchingListing(parsed.fileName, listingCode)) {
            return parsed;
          } else {
            localStorage.removeItem('bolthaven_last_hero_image');
          }
        }
      }
    } catch (_) {}
    return null;
  });

  useEffect(() => {
    if (heroImage && heroImage.url) {
      if (!listingCode || isImageMatchingListing(heroImage.fileName, listingCode)) {
        setLiveHeroImage(heroImage);
      } else {
        setLiveHeroImage(null);
      }
    }
  }, [heroImage, listingCode]);

  useEffect(() => {
    const handleHeroUpdated = (e: any) => {
      if (e?.detail) {
        if (!listingCode || isImageMatchingListing(e.detail.fileName, listingCode)) {
          setLiveHeroImage(e.detail);
        } else {
          setLiveHeroImage(null);
        }
      } else {
        try {
          const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('bolthaven_last_hero_image') : null;
          if (saved) {
            const parsed = JSON.parse(saved);
            const fname = (parsed?.fileName || '').toLowerCase();
            if (fname.includes('hero') && (!listingCode || isImageMatchingListing(parsed.fileName, listingCode))) {
              setLiveHeroImage(parsed);
            } else {
              setLiveHeroImage(null);
            }
          } else {
            setLiveHeroImage(null);
          }
        } catch (_) {
          setLiveHeroImage(null);
        }
      }
    };
    const handleCleared = () => {
      setLiveHeroImage(null);
    };
    window.addEventListener('ea_hero_image_updated', handleHeroUpdated);
    window.addEventListener('storage', handleHeroUpdated);
    window.addEventListener('ea_workflow_cleared', handleCleared);
    return () => {
      window.removeEventListener('ea_hero_image_updated', handleHeroUpdated);
      window.removeEventListener('storage', handleHeroUpdated);
      window.removeEventListener('ea_workflow_cleared', handleCleared);
    };
  }, [listingCode]);

  const effectiveHeroImage = useMemo(() => {
    const candidate = (liveHeroImage && liveHeroImage.url) ? liveHeroImage : (heroImage && heroImage.url) ? heroImage : null;
    if (candidate && listingCode) {
      if (!isImageMatchingListing(candidate.fileName, listingCode)) {
        return null;
      }
    }
    return candidate;
  }, [liveHeroImage, heroImage, listingCode]);

  // Detect if this box is connected from an upstream Enhance node
  const isUpstreamEnhance = useMemo(() => {
    return (connections || []).some((c: any) => {
      if (c.toNodeId !== box.id) return false;
      if (c.fromNodeId === 'get-images' || c.fromNodeId === 'get-content') return false;
      const upBox = (workflowBoxes || []).find((b) => b.id === c.fromNodeId);
      if (!upBox) return false;
      const t = (upBox.title || '').toLowerCase();
      const st = (upBox.subtitle || '').toLowerCase();
      const g = (upBox.browserGroupName || '').toLowerCase();
      const pk = (upBox.processKind || '').toLowerCase();
      const tm = (upBox.tabGroupMode || '').toLowerCase();
      const pt = (upBox.processType || '').toLowerCase();
      return (
        tm === 'enhance' ||
        pk === 'enhance_images' ||
        t.includes('enhance') ||
        st.includes('enhance') ||
        g.includes('enhance') ||
        pt === 'image_enhance' ||
        upBox.provider === 'runware_ai' ||
        upBox.id?.includes('enhance')
      );
    });
  }, [connections, workflowBoxes, box.id]);

  // Direct uploaded images state
  const [uploadedImages, setUploadedImages] = useState<Array<{ id: string; url: string; name?: string }>>(() => {
    // If this is a hero crop node, do NOT load persisted manual uploads - strictly wait for hero generator!
    const isHero =
      box.imageSource === 'generate' ||
      (box.title || '').toLowerCase().includes('hero') ||
      (box.cropFormatId || '').toLowerCase() === 'format-grid-2split';
    if (isHero) return [];

    if (Array.isArray(box.uploadedImages) && box.uploadedImages.length > 0) {
      return box.uploadedImages.map((img: any, i: number) => ({
        id: img.id || `up-${i}`,
        url: typeof img === 'string' ? img : img.url,
        name: img.name || `Photo #${i + 1}`,
      }));
    }
    try {
      const saved = localStorage.getItem(`bolthaven_format_uploads_${box.id}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [isProcessingCrop, setIsProcessingCrop] = useState<boolean>(false);

  // Image Source Selection: 'get_images' | 'enhance' | 'generate' | 'all' | 'upload' | string
  const [imageSource, setImageSource] = useState<string>(() => {
    if (box.imageSource) return box.imageSource;
    if (isHeroCropNode) return 'generate';
    if (box.uploadedImages && box.uploadedImages.length > 0) return 'upload';
    if (isUpstreamEnhance) return 'enhance';
    return 'get_images';
  });

  // Upload handler for image files
  const handleFilesUpload = async (files: FileList | File[]) => {
    const fileArr = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (fileArr.length === 0) return;

    setIsProcessingCrop(true);
    const newItems: Array<{ id: string; url: string; name?: string }> = [];

    for (let i = 0; i < fileArr.length; i++) {
      const file = fileArr[i];
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve((e.target?.result as string) || '');
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
      });

      if (dataUrl) {
        newItems.push({
          id: `up-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
          url: dataUrl,
          name: file.name,
        });
      }
    }

    if (newItems.length > 0) {
      const updated = [...uploadedImages, ...newItems];
      setUploadedImages(updated);
      setImageSource('upload');
      onUpdateBox(box.id, {
        uploadedImages: updated,
        imageSource: 'upload',
        selectedImageIndices: updated.map((_, i) => i + 1),
      });
      try {
        localStorage.setItem(`bolthaven_format_uploads_${box.id}`, JSON.stringify(updated));
      } catch {}

      lastRenderedKeyRef.current = '';
    }
    setIsProcessingCrop(false);
  };

  const handleRemoveUploadedImage = (idToRemove: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const next = uploadedImages.filter((img) => img.id !== idToRemove);
    setUploadedImages(next);
    const nextSource = next.length > 0 ? 'upload' : (isHeroCropNode ? 'generate' : 'get_images');
    setImageSource(nextSource);
    onUpdateBox(box.id, {
      uploadedImages: next,
      imageSource: nextSource,
      selectedImageIndices: next.map((_, i) => i + 1),
    });
    try {
      localStorage.setItem(`bolthaven_format_uploads_${box.id}`, JSON.stringify(next));
    } catch {}
    lastRenderedKeyRef.current = '';
  };

  // Listen for global canvas clear event
  useEffect(() => {
    const handleCleared = () => {
      clearCropSlicesCache();
      setUploadedImages([]);
      setFormattedPreviewItems([]);
      setLiveFormattedPhotos({});
      setCompanionEnhanced({});
      setSelectedIndices([]);
      lastRenderedKeyRef.current = '';
      try {
        localStorage.removeItem(`bolthaven_format_uploads_${box.id}`);
      } catch {}
      try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (k && k.startsWith('bolthaven_canvas_enhanced_')) {
            localStorage.removeItem(k);
          }
        }
      } catch {}
    };
    window.addEventListener('ea_workflow_cleared', handleCleared);
    return () => window.removeEventListener('ea_workflow_cleared', handleCleared);
  }, [box.id, listingCode]);

  // Clear cached crop slices whenever image source or listing code changes
  useEffect(() => {
    clearCropSlicesCache();
    lastRenderedKeyRef.current = '';
    setFormattedPreviewItems([]);
  }, [listingCode, imageSource]);

  // Synchronize when box.uploadedImages is cleared externally
  const prevBoxUploadsRef = useRef<any[] | undefined>(box.uploadedImages);
  useEffect(() => {
    if (prevBoxUploadsRef.current && prevBoxUploadsRef.current.length > 0 && (!box.uploadedImages || box.uploadedImages.length === 0)) {
      if (uploadedImages.length > 0) {
        setUploadedImages([]);
        setFormattedPreviewItems([]);
        setLiveFormattedPhotos({});
        lastRenderedKeyRef.current = '';
      }
    }
    prevBoxUploadsRef.current = box.uploadedImages;
  }, [box.uploadedImages, uploadedImages.length]);

  // Effective images extracted from workflow run
  const effectiveImageList = useMemo(() => {
    if (images && images.length > 0) return images;
    return [];
  }, [images]);

  // Live downloaded enhanced photos polled from companion / backend
  const [companionEnhanced, setCompanionEnhanced] = useState<Record<number, string>>(() => {
    try {
      if (listingCode) {
        const saved = localStorage.getItem(`bolthaven_canvas_enhanced_${listingCode}`);
        if (saved) return JSON.parse(saved);
      }
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
        const activeListingCode = listingCode || (box as any).listingCode || '';
        const downloaded = await fetchEnhancedDownloadedImages(undefined, activeListingCode);
        if (downloaded && downloaded.length > 0 && !isCancelled) {
          const maxAllowed = effectiveImageList?.length || 6;
          // STRICT listing code verification:
          // If activeListingCode is present, only accept files whose filename includes activeListingCode!
          // NEVER fall back to picking any random prefix from other files!
          const requiredPrefix = activeListingCode ? activeListingCode.trim().toLowerCase() : '';

          const valid = downloaded.filter((img) => {
            const pos = img.position || 1;
            if (pos > maxAllowed) return false;
            if (requiredPrefix && img.filename) {
              return img.filename.toLowerCase().includes(requiredPrefix);
            }
            return !requiredPrefix;
          });

          if (valid.length === 0) {
            setCompanionEnhanced({});
            try {
              const codeKey = listingCode || 'current';
              localStorage.removeItem(`bolthaven_canvas_enhanced_${codeKey}`);
            } catch {}
            return;
          }

          const map: Record<number, string> = {};
          valid.forEach((img) => {
            const pos = img.position || 1;
            const pos0 = pos - 1; // 0-based index key
            // Prefer clean relative /storage URL to leverage same-origin Vite proxy
            const cleanBackend = img.backend_url
              ? img.backend_url.replace(/^https?:\/\/localhost:8085/, '')
              : (img.filename ? `/storage/uploads/facebook-import/enhanced/${encodeURIComponent(img.filename)}` : '');
            map[pos0] = cleanBackend || img.url;
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
            try {
              const codeKey = listingCode || 'current';
              localStorage.setItem(`bolthaven_canvas_enhanced_${codeKey}`, JSON.stringify(map));
            } catch {}
            return map;
          });
        } else if (!isCancelled && downloaded && downloaded.length === 0) {
          // If no downloaded images found on disk/companion, clear companionEnhanced
          setCompanionEnhanced({});
          try {
            const codeKey = listingCode || 'current';
            localStorage.removeItem(`bolthaven_canvas_enhanced_${codeKey}`);
          } catch {}
        }
      } catch (e) {
        if (!isCancelled) setCompanionEnhanced({});
      }
    };
    // Load once when clicking this box / when modal opens
    loadDownloaded();
    return () => {
      isCancelled = true;
    };
  }, [box.id, listingCode, effectiveImageList?.length, isUpstreamEnhance]);

  const mergedEnhancedPhotos = useMemo(() => {
    // Merge enhancedPhotos and companionEnhanced, normalizing all enhanced image URLs
    const merged: Record<number, string> = {};
    const maxAllowed = Math.max(effectiveImageList?.length || 0, 99);
    const sourceObj = { ...(enhancedPhotos || {}), ...companionEnhanced };
    Object.entries(sourceObj).forEach(([k, url]) => {
      const num = Number(k);
      // Strictly ignore any image index beyond valid bounds
      if (isNaN(num) || num < 0 || num > maxAllowed) return;
      if (!url) return;
      let clean = url;
      if (clean.includes('localhost:8085/storage/')) {
        clean = clean.replace(/^https?:\/\/localhost:8085/, '');
      } else if (clean.includes('/downloaded-image?file=')) {
        try {
          const u = new URL(clean, typeof window !== 'undefined' ? window.location.origin : undefined);
          const f = u.searchParams.get('file');
          if (f) clean = `/storage/uploads/facebook-import/enhanced/${encodeURIComponent(f)}`;
        } catch (_) {}
      }
      merged[num] = clean;
    });
    return merged;
  }, [companionEnhanced, enhancedPhotos, effectiveImageList?.length]);

  const hasEnhancedPhotos = Object.keys(mergedEnhancedPhotos).length > 0;

  const isEnhanceSource = useMemo(() => {
    if (imageSource === 'upload') return false;
    const selectedSourceNode = (imageSource && imageSource.startsWith('node:'))
      ? (workflowBoxes || []).find((b: any) => b.id === imageSource.replace('node:', '')) || null
      : null;
    const isTargetEnhance = Boolean(
      selectedSourceNode &&
      (selectedSourceNode.tabGroupMode === 'enhance' ||
        selectedSourceNode.processKind === 'enhance_images' ||
        (selectedSourceNode.title || '').toLowerCase().includes('enhance') ||
        (selectedSourceNode.browserGroupName || '').toLowerCase().includes('enhance'))
    );
    return Boolean(
      isTargetEnhance ||
      (!selectedSourceNode && (
        imageSource === 'enhance' ||
        (typeof imageSource === 'string' && imageSource.includes('enhance')) ||
        (!box.imageSource && isUpstreamEnhance)
      ))
    );
  }, [imageSource, workflowBoxes, box.imageSource, isUpstreamEnhance]);

  // Build the list of photos available for the currently selected source
  const currentSourceList = useMemo(() => {
    const rawList: Array<{
      id: string;
      index: number;
      displayNumber: number;
      url: string;
      source: 'get_images' | 'enhance' | 'generate' | 'upload';
      label: string;
      isEnhanced?: boolean;
    }> = [];

    // If user has uploaded images and source is upload (or explicitly uploaded), use them directly!
    if (imageSource === 'upload' && uploadedImages.length > 0) {
      return uploadedImages.map((img, idx) => ({
        id: img.id || `up-${idx + 1}`,
        index: idx + 1,
        displayNumber: idx + 1,
        url: img.url,
        source: 'upload' as const,
        label: img.name || `Uploaded #${idx + 1}`,
        isEnhanced: false,
      }));
    }

    const selectedSourceNode = (imageSource && imageSource.startsWith('node:'))
      ? (workflowBoxes || []).find((b: any) => b.id === imageSource.replace('node:', '')) || null
      : null;

    const isTargetHero = Boolean(
      selectedSourceNode &&
      (selectedSourceNode.tabGroupMode === 'generate' ||
        selectedSourceNode.processKind === 'generate_image' ||
        (selectedSourceNode.title || '').toLowerCase().includes('hero') ||
        (selectedSourceNode.browserGroupName || '').toLowerCase().includes('hero'))
    );

    const isTargetEnhance = Boolean(
      selectedSourceNode &&
      (selectedSourceNode.tabGroupMode === 'enhance' ||
        selectedSourceNode.processKind === 'enhance_images' ||
        (selectedSourceNode.title || '').toLowerCase().includes('enhance') ||
        (selectedSourceNode.browserGroupName || '').toLowerCase().includes('enhance'))
    );

    const activeHeroImage = (() => {
      const target = isTargetHero ? selectedSourceNode : heroNode;
      if (target) {
        try {
          const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(`bolthaven_hero_image_${target.id}`) : null;
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed?.url && isImageMatchingListing(parsed.fileName, listingCode)) {
              return parsed;
            }
          }
        } catch (_) {}
      }
      if (effectiveHeroImage && effectiveHeroImage.url && isImageMatchingListing(effectiveHeroImage.fileName, listingCode)) {
        const targetTitle = (target?.title || '').toLowerCase();
        const fn = (effectiveHeroImage.fileName || '').toLowerCase();
        const isTikTok = targetTitle.includes('tiktok');
        if (isTikTok && fn.includes('tiktok')) return effectiveHeroImage;
        if (!isTikTok && !fn.includes('tiktok')) return effectiveHeroImage;
      }
      return null;
    })();

    const isHeroSource =
      imageSource !== 'upload' &&
      (isTargetHero ||
        (!selectedSourceNode && (
          imageSource === 'generate' ||
          (typeof imageSource === 'string' && (imageSource.includes('hero') || imageSource.includes('generator'))) ||
          (!box.imageSource && isHeroCropNode)
        )));

    // 0. Hero Crop Node (FB Hero / BG Hero): strictly wait for or use generated hero image!
    if (isHeroSource) {
      if (activeHeroImage && activeHeroImage.url) {
        const heroNodeLabel = (selectedSourceNode?.title || selectedSourceNode?.browserGroupName || heroLabel || 'Hero').trim();
        return [{
          id: `${selectedSourceNode?.id || 'hero'}-1`,
          index: 1,
          displayNumber: 1,
          url: activeHeroImage.url,
          source: 'generate',
          label: activeHeroImage.condoName ? `${activeHeroImage.condoName} Hero` : `${heroNodeLabel} (1 Photo)`,
        }];
      }
      // If hero image has NOT been generated yet:
      // Strictly wait for Hero image! Do NOT load get_images, do NOT load enhance photos, do NOT fallback to uploaded files!
      return [];
    }

    const isEnhanceEmpty = isEnhanceSource;
    const shouldUseUploaded =
      imageSource === 'upload' ||
      (uploadedImages.length > 0 &&
        ((isEnhanceEmpty && !hasEnhancedPhotos) ||
         (!isEnhanceSource && (!effectiveImageList || effectiveImageList.length === 0))));

    if (shouldUseUploaded && uploadedImages.length > 0) {
      uploadedImages.forEach((img, idx) => {
        const photoNum = idx + 1;
        rawList.push({
          id: img.id || `up-${photoNum}`,
          index: photoNum,
          displayNumber: photoNum,
          url: img.url,
          source: 'upload',
          label: img.name || `Uploaded #${photoNum}`,
          isEnhanced: false,
        });
      });
      return rawList;
    }

    // When upstream is an Enhance node, merge with the first step's photos!
    if (isEnhanceSource) {
      if (!hasEnhancedPhotos) {
        return [];
      }
      const enhancedIndices = Object.keys(mergedEnhancedPhotos).map(Number).filter((n) => !isNaN(n));
      const maxEnhanced = enhancedIndices.length > 0 ? Math.max(...enhancedIndices) + 1 : 0;
      const totalPhotos = Math.max(effectiveImageList?.length || 0, maxEnhanced);

      for (let idx = 0; idx < totalPhotos; idx++) {
        const photoNum = idx + 1;
        const enhancedUrl =
          mergedEnhancedPhotos[idx] ||
          mergedEnhancedPhotos[photoNum] ||
          (mergedEnhancedPhotos as any)[String(idx)] ||
          (mergedEnhancedPhotos as any)[String(photoNum)];

        // Only include actual enhanced photos! Never fallback to raw un-enhanced photos!
        if (!enhancedUrl) {
          continue;
        }

        rawList.push({
          id: `enh-${photoNum}`,
          index: photoNum,
          displayNumber: photoNum,
          url: enhancedUrl,
          source: 'enhance',
          label: `Enhanced #${photoNum}`,
          isEnhanced: true,
        });
      }

      return rawList;
    }

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

    // 3. Generate Image (Hero generator: BG Hero Generator / FB Hero)
    if ((imageSource as any) === 'all') {
      if (effectiveHeroImage && effectiveHeroImage.url) {
        rawList.push({
          id: 'hero-1',
          index: 999,
          displayNumber: 1,
          url: effectiveHeroImage.url,
          source: 'generate',
          label: effectiveHeroImage.condoName ? `${effectiveHeroImage.condoName} Hero` : `${heroLabel} #1`,
        });
      }
    }

    // If 'all' mode and uploadedImages exist, include them as well
    if (imageSource === 'all' && uploadedImages.length > 0) {
      uploadedImages.forEach((img, idx) => {
        const photoNum = rawList.length + idx + 1;
        rawList.push({
          id: img.id || `up-${photoNum}`,
          index: photoNum,
          displayNumber: photoNum,
          url: img.url,
          source: 'upload',
          label: img.name || `Uploaded #${idx + 1}`,
          isEnhanced: false,
        });
      });
    }

    return rawList;
  }, [
    isHeroCropNode,
    isUpstreamEnhance,
    isEnhanceSource,
    hasEnhancedPhotos,
    imageSource,
    mergedEnhancedPhotos,
    effectiveImageList,
    watermarkedPhotos,
    effectiveHeroImage,
    heroLabel,
    uploadedImages,
  ]);

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
      const validIndices = selectedIndices.filter((idx) => currentSourceList.some((p) => p.index === idx));
      const shouldSelectAll =
        selectedIndices.length === 0 ||
        !isCustomExplicit ||
        validIndices.length === 0 ||
        validIndices.length !== selectedIndices.length;

      if (shouldSelectAll && (selectedIndices.length !== currentSourceList.length || validIndices.length !== selectedIndices.length)) {
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

  const [brokenPhotoIds, setBrokenPhotoIds] = useState<Set<string>>(new Set());

  const activePhotosToFormat = useMemo(() => {
    const nonBroken = currentSourceList.filter((p) => !brokenPhotoIds.has(p.id));
    const list = nonBroken.filter((p) => selectedIndices.includes(p.index));
    return list.length > 0 ? list : nonBroken;
  }, [currentSourceList, selectedIndices, brokenPhotoIds]);

  const formatOptions = useMemo<SelectOption[]>(() => {
    return savedFormats.map((f) => ({
      value: f.id,
      label: `${f.name} (${f.targetWidth}×${f.targetHeight} · ${f.aspect || '1:1'})`,
    }));
  }, [savedFormats]);

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
      setIsProcessingCrop(true);
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
        setIsProcessingCrop(false);
      }
    };

    // Debounce preview generation to allow rapid batch / companion downloads to settle
    const debounceTimer = setTimeout(() => {
      generatePreviews();
    }, 300);

    return () => {
      isCancelled = true;
      clearTimeout(debounceTimer);
      setIsProcessingCrop(false);
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

  const handleTriggerCropProcess = () => {
    activePhotosToFormat.forEach((p) => {
      clearCropSlicesCache(p.url);
    });
    setIsProcessingCrop(true);
    lastRenderedKeyRef.current = '';
    setFormattedPreviewItems([]);
  };

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

  const handleSourceChange = (newSrc: string) => {
    setImageSource(newSrc);
    onUpdateBox(box.id, { imageSource: newSrc });
    lastRenderedKeyRef.current = '';
    setSelectedPhotoIndex(1);
  };

  const sourceOptions: SelectOption[] = useMemo(() => {
    const opts: SelectOption[] = [];
    const getImagesCount = effectiveImageList.length;
    const enhanceCount = Object.keys(mergedEnhancedPhotos).length;
    const heroCount = (effectiveHeroImage && effectiveHeroImage.url) ? 1 : 0;

    const heroNodes = (workflowBoxes || []).filter(
      (b) =>
        b.id !== box.id &&
        (b.tabGroupMode === 'generate' ||
          b.processKind === 'generate_image' ||
          b.title?.toLowerCase().includes('hero') ||
          b.browserGroupName?.toLowerCase().includes('hero'))
    );

    if (heroNodes.length > 0) {
      heroNodes.forEach((hn) => {
        const title = (hn.title || hn.browserGroupName || 'Hero').trim();
        let hasImg = false;
        try {
          const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(`bolthaven_hero_image_${hn.id}`) : null;
          if (raw) {
            const p = JSON.parse(raw);
            if (p?.url && isImageMatchingListing(p.fileName, listingCode)) hasImg = true;
          }
        } catch (_) {}
        if (!hasImg && effectiveHeroImage?.url && isImageMatchingListing(effectiveHeroImage.fileName, listingCode)) {
          const tLower = title.toLowerCase();
          const fn = (effectiveHeroImage.fileName || '').toLowerCase();
          const isTT = tLower.includes('tiktok');
          if ((isTT && fn.includes('tiktok')) || (!isTT && !fn.includes('tiktok'))) {
            hasImg = true;
          }
        }
        opts.push({
          value: heroNodes.length === 1 ? 'generate' : `node:${hn.id}`,
          label: `${title} (${hasImg ? '1 Photo' : 'Waiting for Hero'})`,
        });
      });
    } else if (heroNode || isHeroCropNode) {
      opts.push({
        value: 'generate',
        label: `${heroLabel} (${heroCount > 0 ? `${heroCount} Photo` : 'Waiting for Hero'})`,
      });
    }

    const enhanceNodes = (workflowBoxes || []).filter(
      (b) =>
        b.id !== box.id &&
        (b.tabGroupMode === 'enhance' ||
          b.processKind === 'enhance_images' ||
          b.title?.toLowerCase().includes('enhance') ||
          b.browserGroupName?.toLowerCase().includes('enhance'))
    );

    if (enhanceNodes.length > 0) {
      enhanceNodes.forEach((en) => {
        const title = (en.title || en.browserGroupName || 'Enhance Image').trim();
        opts.push({
          value: enhanceNodes.length === 1 ? 'enhance' : `node:${en.id}`,
          label: `${title} (${enhanceCount} ${enhanceCount === 1 ? 'Photo' : 'Photos'})`,
        });
      });
    } else if (isUpstreamEnhance || enhanceNode) {
      opts.push({
        value: 'enhance',
        label: `${enhanceLabel} (${enhanceCount} ${enhanceCount === 1 ? 'Photo' : 'Photos'})`,
      });
    }

    opts.push({
      value: 'get_images',
      label: `Get Images (${getImagesCount} ${getImagesCount === 1 ? 'Photo' : 'Photos'})`,
    });

    const totalCount = (enhanceCount > 0 ? enhanceCount : getImagesCount) + heroCount;
    opts.push({
      value: 'all',
      label: `All Photos (${totalCount} ${totalCount === 1 ? 'Photo' : 'Photos'})`,
    });

    if (uploadedImages.length > 0) {
      opts.push({
        value: 'upload',
        label: `Uploaded Files (${uploadedImages.length} ${uploadedImages.length === 1 ? 'Photo' : 'Photos'})`,
      });
    }

    return opts;
  }, [effectiveImageList.length, mergedEnhancedPhotos, effectiveHeroImage, heroLabel, enhanceLabel, workflowBoxes, box.id, heroNode, isHeroCropNode, enhanceNode, isUpstreamEnhance, uploadedImages.length]);

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
              {currentFormat?.targetWidth} × {currentFormat?.targetHeight} px • Source:{' '}
              {isHeroCropNode && imageSource !== 'upload'
                ? `${heroLabel} (${effectiveHeroImage && effectiveHeroImage.url ? '1 Photo' : 'Waiting for Hero Image'})`
                : imageSource === 'upload' || (activePhotosToFormat.length > 0 && (activePhotosToFormat[0] as any)?.source === 'upload')
                ? `Uploaded Files (${activePhotosToFormat.length} Photos)`
                : imageSource === 'generate'
                ? `${heroLabel} (${effectiveHeroImage && effectiveHeroImage.url ? '1 Photo' : '0 Photos'})`
                : imageSource === 'enhance' || isUpstreamEnhance
                ? `${enhanceLabel} (${activePhotosToFormat.length > 0 ? `${activePhotosToFormat.length} Photos` : 'Waiting for Enhance IMG'})`
                : `Get Images (${activePhotosToFormat.length} Photos)`}
            </div>
          </div>
        </div>

        {/* Hidden file input for uploading local images */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFilesUpload(e.target.files);
              e.target.value = '';
            }
          }}
        />

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
              height: '28px',
              padding: '0 10px',
              borderRadius: '8px',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
              color: 'var(--text-secondary)',
              fontSize: '0.6875rem',
              fontWeight: 500,
              cursor: 'pointer',
              flexShrink: 0,
              pointerEvents: 'auto',
              userSelect: 'none',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            <FiSettings size={12} style={{ pointerEvents: 'none' }} />
            <span style={{ pointerEvents: 'none' }}>Settings</span>
          </button>
        )}
      </div>

      {/* Processed Photos Live Preview */}
      {displayPreviewItems.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginTop: '0.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Processed Photos Preview
              </label>
              <span
                style={{
                  fontSize: '0.625rem',
                  fontWeight: 600,
                  color: isProcessingCrop ? '#3B82F6' : (box.enabled === false ? 'var(--text-muted)' : '#10B981'),
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: isProcessingCrop ? 'rgba(59, 130, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  border: isProcessingCrop ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
                }}
              >
                {isProcessingCrop ? '⚡ Cropping...' : box.enabled === false ? '⏸️ Bypassed' : `✓ ${displayPreviewItems.length} ${isGridFormat && displayPreviewItems.length > 1 ? 'Tiles' : 'Photos'} Ready`}
              </span>
            </div>

            {/* Quick Action Buttons: Upload More & Run Crop Process */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {imageSource === 'upload' && (isHeroCropNode || heroNode) && (
                <button
                  type="button"
                  onClick={() => {
                    clearCropSlicesCache();
                    setImageSource('generate');
                    onUpdateBox(box.id, {
                      imageSource: 'generate',
                    });
                  }}
                  title={`Switch back to waiting for ${heroLabel}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    borderRadius: '5px',
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.08)',
                    border: isDark ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(245, 158, 11, 0.3)',
                    color: '#F59E0B',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  <FiClock size={11} />
                  <span>Wait for {heroLabel}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Upload image files from computer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '0 10px',
                  height: '26px',
                  borderRadius: '8px',
                  fontSize: '0.6875rem',
                  fontWeight: 500,
                  backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF',
                  border: isDark ? '1px solid rgba(59, 130, 246, 0.35)' : '1px solid #BFDBFE',
                  color: isDark ? '#93C5FD' : '#2563EB',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <FiUpload size={11} />
                <span>Upload</span>
              </button>

              <button
                type="button"
                onClick={handleTriggerCropProcess}
                disabled={isProcessingCrop}
                title="Process crop again with current preset"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '0 10px',
                  height: '26px',
                  borderRadius: '8px',
                  fontSize: '0.6875rem',
                  fontWeight: 500,
                  backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
                  border: isDark ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid #A7F3D0',
                  color: isDark ? '#6EE7B7' : '#059669',
                  cursor: isProcessingCrop ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <FiRefreshCw size={11} style={isProcessingCrop ? { animation: 'spin 1s linear infinite' } : {}} />
                <span>{isProcessingCrop ? 'Cropping...' : 'Process Crop'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  clearCropSlicesCache();
                  setUploadedImages([]);
                  setFormattedPreviewItems([]);
                  setLiveFormattedPhotos({});
                  setSelectedIndices([]);
                  lastRenderedKeyRef.current = '';
                  try {
                    localStorage.removeItem(`bolthaven_format_uploads_${box.id}`);
                  } catch {}
                  onUpdateBox(box.id, {
                    uploadedImages: [],
                    imageSource: undefined,
                    selectedImageIndices: undefined,
                  });
                }}
                title="Clear photos from this format node"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '0 10px',
                  height: '26px',
                  borderRadius: '8px',
                  fontSize: '0.6875rem',
                  fontWeight: 500,
                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2',
                  border: isDark ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid #FECACA',
                  color: isDark ? '#F87171' : '#DC2626',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <FiTrash2 size={11} />
                <span>Clear</span>
              </button>
            </div>
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
                      onError={(e) => {
                        const target = e.currentTarget as HTMLImageElement;
                        if (!target.dataset.triedFallback) {
                          target.dataset.triedFallback = 'true';
                          const currentSrc = target.src;
                          if (currentSrc.includes('/downloaded-image?file=')) {
                            try {
                              const filename = new URL(currentSrc).searchParams.get('file');
                              if (filename) {
                                target.src = `/storage/uploads/facebook-import/enhanced/${filename}`;
                                return;
                              }
                            } catch (_) {}
                          }
                          if (currentSrc.includes('/storage/uploads/facebook-import/enhanced/')) {
                            const filename = currentSrc.split('/').pop();
                            if (filename) {
                              target.src = `http://127.0.0.1:9224/downloaded-image?file=${filename}`;
                              return;
                            }
                          }
                          if (currentSrc.includes('localhost:8085/storage/')) {
                            target.src = currentSrc.replace(/^https?:\/\/localhost:8085/, '');
                            return;
                          }
                        }
                        // Mark photo as broken so it's excluded from preview grid
                        setBrokenPhotoIds((prev) => {
                          const next = new Set(prev);
                          next.add(item.id);
                          return next;
                        });
                      }}
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

                      {/* Delete button if photo is an uploaded file */}
                      {uploadedImages.some((u) => u.id === item.sourcePhotoId || item.id?.startsWith('up-') || item.sourcePhotoId?.startsWith('up-')) && (
                        <button
                          type="button"
                          onClick={(e) => handleRemoveUploadedImage(item.sourcePhotoId, e)}
                          title="Remove uploaded image"
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            backgroundColor: 'rgba(239, 68, 68, 0.85)',
                            border: '1px solid rgba(255, 255, 255, 0.35)',
                            color: '#FFFFFF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#DC2626')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.85)')}
                        >
                          <FiTrash2 size={12} />
                        </button>
                      )}
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
                height: '34px',
                padding: '0 12px',
                borderRadius: '8px',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
                color: 'var(--text-secondary)',
                fontSize: '0.78125rem',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: isDownloading ? 'wait' : 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9';
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
      ) : (isHeroCropNode && imageSource !== 'upload' && uploadedImages.length === 0) ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginTop: '0.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Processed Photos Preview
              </label>
              <span
                style={{
                  fontSize: '0.625rem',
                  fontWeight: 600,
                  color: '#F59E0B',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: 'rgba(245, 158, 11, 0.1)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                }}
              >
                ⏳ Waiting for {heroLabel}
              </span>
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Upload photo manually to skip waiting"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '5px',
                backgroundColor: isDark ? 'rgba(59, 130, 246, 0.12)' : 'rgba(59, 130, 246, 0.08)',
                border: isDark ? '1px solid rgba(59, 130, 246, 0.35)' : '1px solid rgba(59, 130, 246, 0.3)',
                color: '#3B82F6',
                fontSize: '0.6875rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background-color 0.15s ease',
              }}
            >
              <FiUpload size={11} />
              <span>Upload Manual</span>
            </button>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingOver(true);
            }}
            onDragLeave={() => setIsDraggingOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingOver(false);
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleFilesUpload(e.dataTransfer.files);
              }
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2.5rem 1.25rem',
              borderRadius: '10px',
              border: isDraggingOver
                ? '2px dashed #3B82F6'
                : isDark
                ? '1px solid #30363D'
                : '1px solid #E2E8F0',
              backgroundColor: isDraggingOver
                ? (isDark ? 'rgba(59, 130, 246, 0.12)' : 'rgba(59, 130, 246, 0.06)')
                : (isDark ? 'rgba(245, 158, 11, 0.04)' : 'rgba(245, 158, 11, 0.03)'),
              gap: '12px',
              textAlign: 'center',
              transition: 'all 0.2s ease',
            }}
          >
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#F59E0B',
              }}
            >
              <FiClock size={22} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Waiting for {heroLabel} Image
              </span>
              <span style={{ fontSize: '0.71875rem', color: 'var(--text-muted)', maxWidth: '340px', lineHeight: 1.5 }}>
                The upstream {heroLabel} node has not generated an image yet. Once {heroLabel} generates and downloads the image, this node will automatically set up the crop tiles without showing other photos.
              </span>
            </div>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '6px',
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                color: '#F59E0B',
                fontSize: '0.6875rem',
                fontWeight: 500,
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#F59E0B',
                }}
              />
              <span>Awaiting Hero generation</span>
            </div>

            {/* Manual Upload Option if User Doesn't Want to Wait */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                marginTop: '4px',
                width: '100%',
                maxWidth: '340px',
                paddingTop: '14px',
                borderTop: isDark ? '1px dashed #30363D' : '1px dashed #E2E8F0',
              }}
            >
              <span style={{ fontSize: '0.71875rem', color: 'var(--text-muted)' }}>
                Don't want to wait? You can upload manually:
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                disabled={isProcessingCrop}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 16px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--accent-primary, #3B82F6)',
                  color: '#FFFFFF',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: isProcessingCrop ? 'not-allowed' : 'pointer',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
                  transition: 'opacity 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                <FiUploadCloud size={15} />
                <span>{isProcessingCrop ? 'Uploading...' : 'Upload Photo Manually'}</span>
              </button>
              <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                or drag & drop your image here
              </span>
            </div>
          </div>
        </div>
      ) : ((isEnhanceSource || imageSource === 'enhance') && imageSource !== 'upload' && uploadedImages.length === 0) ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginTop: '0.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Processed Photos Preview
              </label>
              <span
                style={{
                  fontSize: '0.625rem',
                  fontWeight: 600,
                  color: '#F59E0B',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: 'rgba(245, 158, 11, 0.1)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                }}
              >
                ⏳ Waiting for {enhanceLabel}
              </span>
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Upload photos manually to skip waiting"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '5px',
                backgroundColor: isDark ? 'rgba(59, 130, 246, 0.12)' : 'rgba(59, 130, 246, 0.08)',
                border: isDark ? '1px solid rgba(59, 130, 246, 0.35)' : '1px solid rgba(59, 130, 246, 0.3)',
                color: '#3B82F6',
                fontSize: '0.6875rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background-color 0.15s ease',
              }}
            >
              <FiUpload size={11} />
              <span>Upload Manual</span>
            </button>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingOver(true);
            }}
            onDragLeave={() => setIsDraggingOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingOver(false);
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleFilesUpload(e.dataTransfer.files);
              }
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2.5rem 1.25rem',
              borderRadius: '10px',
              border: isDraggingOver
                ? '2px dashed #3B82F6'
                : isDark
                ? '1px solid #30363D'
                : '1px solid #E2E8F0',
              backgroundColor: isDraggingOver
                ? (isDark ? 'rgba(59, 130, 246, 0.12)' : 'rgba(59, 130, 246, 0.06)')
                : (isDark ? 'rgba(245, 158, 11, 0.04)' : 'rgba(245, 158, 11, 0.03)'),
              gap: '12px',
              textAlign: 'center',
              transition: 'all 0.2s ease',
            }}
          >
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#F59E0B',
              }}
            >
              <FiClock size={22} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Waiting for {enhanceLabel} Photos
              </span>
              <span style={{ fontSize: '0.71875rem', color: 'var(--text-muted)', maxWidth: '340px', lineHeight: 1.5 }}>
                The upstream {enhanceLabel} node has not enhanced photos yet for this canvas run. Once {enhanceLabel} processes and downloads the enhanced photos, this studio will automatically set up the crop tiles.
              </span>
            </div>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '6px',
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                color: '#F59E0B',
                fontSize: '0.6875rem',
                fontWeight: 500,
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#F59E0B',
                }}
              />
              <span>Awaiting image enhancement</span>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                marginTop: '4px',
                width: '100%',
                maxWidth: '340px',
                paddingTop: '14px',
                borderTop: isDark ? '1px dashed #30363D' : '1px dashed #E2E8F0',
              }}
            >
              <span style={{ fontSize: '0.71875rem', color: 'var(--text-muted)' }}>
                Don't want to wait? You can upload manually:
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                disabled={isProcessingCrop}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 16px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--accent-primary, #3B82F6)',
                  color: '#FFFFFF',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: isProcessingCrop ? 'not-allowed' : 'pointer',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
                  transition: 'opacity 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                <FiUploadCloud size={15} />
                <span>{isProcessingCrop ? 'Uploading...' : 'Upload Photos Manually'}</span>
              </button>
              <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                or drag & drop your photos here
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingOver(true);
          }}
          onDragLeave={() => setIsDraggingOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDraggingOver(false);
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              handleFilesUpload(e.dataTransfer.files);
            }
          }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2.5rem 1.25rem',
            borderRadius: '10px',
            border: isDraggingOver
              ? '2px dashed #3B82F6'
              : isDark
              ? '1.5px dashed #30363D'
              : '1.5px dashed #CBD5E1',
            backgroundColor: isDraggingOver
              ? (isDark ? 'rgba(59, 130, 246, 0.12)' : 'rgba(59, 130, 246, 0.06)')
              : (isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.015)'),
            gap: '12px',
            marginTop: '0.25rem',
            transition: 'all 0.2s ease',
            cursor: 'pointer',
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#3B82F6',
            }}
          >
            <FiUploadCloud size={24} />
          </div>

          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Upload Photos for Crop & Format
            </span>
            <span style={{ fontSize: '0.71875rem', color: 'var(--text-muted)', maxWidth: '320px', lineHeight: 1.45 }}>
              {imageSource === 'generate'
                ? `The upstream ${heroLabel} node has not generated a photo yet. You can upload photos directly to run the crop process.`
                : imageSource === 'enhance' || isUpstreamEnhance
                ? `The upstream ${enhanceLabel} node has not enhanced photos yet. You can upload photos directly to run the crop process.`
                : 'Drag & drop photos here, or click to browse files from your computer to run the crop process.'}
            </span>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            disabled={isProcessingCrop}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 16px',
              borderRadius: '6px',
              backgroundColor: '#3B82F6',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: isProcessingCrop ? 'not-allowed' : 'pointer',
              marginTop: '4px',
              boxShadow: '0 2px 6px rgba(59, 130, 246, 0.3)',
              transition: 'background-color 0.15s ease',
            }}
          >
            {isProcessingCrop ? (
              <>
                <FiRefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Processing Crop...</span>
              </>
            ) : (
              <>
                <FiUpload size={13} />
                <span>Choose Files to Upload</span>
              </>
            )}
          </button>

          <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
            Target Format: <strong style={{ color: 'var(--text-secondary)' }}>{currentFormat?.name}</strong> ({currentFormat?.targetWidth}×{currentFormat?.targetHeight} · {currentFormat?.aspect})
          </span>
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
