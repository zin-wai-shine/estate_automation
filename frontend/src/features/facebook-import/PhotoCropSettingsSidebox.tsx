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
import { ToggleSwitch } from '../../components/ui/ToggleSwitch';

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
  heroImage?: { url: string; fileName?: string; condoName?: string } | null;
  embedded?: boolean;
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
  embedded = false,
}) => {
  const listingCode = _listingCode || (() => {
    try {
      return localStorage.getItem('bolthaven_active_session_listing_code') || '';
    } catch {
      return '';
    }
  })();
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

  const currentFormat = useMemo(() => {
    return (
      savedFormats.find((f) => f.id === selectedFormatId) ||
      savedFormats.find((f) => f.id === box.cropFormatId || f.id === box.templateId) ||
      savedFormats.find((f) => box.templateText && f.name.toLowerCase() === box.templateText.toLowerCase()) ||
      savedFormats.find((f) => box.title && f.name && box.title.toLowerCase().includes(f.name.toLowerCase())) ||
      savedFormats[0]
    );
  }, [savedFormats, selectedFormatId, box.cropFormatId, box.templateId, box.templateText, box.title]);

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
    return workflowBoxes.find(
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

  const isRunnerBox = (b: any): boolean => {
    if (!b) return false;
    return (
      b.processType === 'external_browser' ||
      b.processType === 'chrome_profile' ||
      Boolean(b.id?.includes('external-browser')) ||
      Boolean(b.id?.includes('chrome-')) ||
      Boolean(b.title?.toLowerCase().includes('external browser'))
    );
  };

  const resolveActualImageNode = (candidate: any): any => {
    if (!candidate) return null;
    if (isRunnerBox(candidate)) {
      const match = (workflowBoxes || []).find(
        (b) =>
          b.id !== candidate.id &&
          !isRunnerBox(b) &&
          (b.processType === 'chrome_tab_group' || b.id?.includes('tabgroup')) &&
          (b.browserGroupName === candidate.browserGroupName ||
            (candidate.browserGroupName && b.title === candidate.browserGroupName) ||
            b.title?.toLowerCase().includes('enhance') ||
            b.title?.toLowerCase().includes('hero'))
      );
      if (match) return match;
    }
    return candidate;
  };

  // Dynamically resolve Enhance node title from workflow boxes
  const connectedUpstreamEnhance = useMemo(() => {
    const incoming = (connections || []).filter((c) => c.toNodeId === box.id);
    for (const conn of incoming) {
      const rawUpBox = (workflowBoxes || []).find((b: any) => b.id === conn.fromNodeId);
      const upBox = resolveActualImageNode(rawUpBox);
      if (
        upBox &&
        (upBox.tabGroupMode === 'enhance' ||
          upBox.processKind === 'enhance_images' ||
          upBox.processType === 'chrome_tab_group' ||
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
      const rawFound = (workflowBoxes || []).find((b) => b.id === targetId);
      const found = resolveActualImageNode(rawFound);
      if (
        found &&
        (found.tabGroupMode === 'enhance' ||
          found.processKind === 'enhance_images' ||
          found.processType === 'chrome_tab_group' ||
          found.title?.toLowerCase().includes('enhance') ||
          found.browserGroupName?.toLowerCase().includes('enhance'))
      ) {
        return found;
      }
    }
    const directTabGroup = (workflowBoxes || []).find(
      (b) =>
        !isRunnerBox(b) &&
        (b.processType === 'chrome_tab_group' || b.id?.includes('tabgroup')) &&
        (b.title?.toLowerCase().includes('enhance') ||
          b.browserGroupName?.toLowerCase().includes('enhance') ||
          b.tabGroupMode === 'enhance') &&
        b.id !== box.id
    );
    if (directTabGroup) return directTabGroup;

    return (workflowBoxes || []).find(
      (b) =>
        !isRunnerBox(b) &&
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

    return connections.some((c: any) => {
      if (c.toNodeId !== box.id) return false;
      if (c.fromNodeId === 'get-images' || c.fromNodeId === 'get-content') return false;
      const upBox = workflowBoxes.find((b: any) => b.id === c.fromNodeId);
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
        if (parsed?.url) {
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

  // Image source: 'get_images' | 'enhance' | 'generate' | 'all' | string
  const [imageSource, setImageSource] = useState<string>(() => {
    if (box.imageSource) return box.imageSource;
    if (isHeroCropNode) return 'generate';
    if (isUpstreamEnhance) return 'enhance';
    return 'get_images';
  });

  useEffect(() => {
    if (box.imageSource && box.imageSource !== imageSource) {
      setImageSource(box.imageSource);
    }
  }, [box.imageSource]);

  // Selected source node when chosen explicitly via dropdown
  const selectedSourceNode = useMemo(() => {
    if (imageSource && imageSource.startsWith('node:')) {
      const targetId = imageSource.replace('node:', '');
      return (workflowBoxes || []).find((b: any) => b.id === targetId) || null;
    }
    return null;
  }, [imageSource, workflowBoxes]);

  const isTargetHero = useMemo(() => {
    if (!selectedSourceNode) return false;
    const t = (selectedSourceNode.title || '').toLowerCase();
    const g = (selectedSourceNode.browserGroupName || '').toLowerCase();
    return (
      selectedSourceNode.tabGroupMode === 'generate' ||
      selectedSourceNode.processKind === 'generate_image' ||
      t.includes('hero') ||
      g.includes('hero')
    );
  }, [selectedSourceNode]);

  const isTargetEnhance = useMemo(() => {
    if (!selectedSourceNode) return false;
    const t = (selectedSourceNode.title || '').toLowerCase();
    const g = (selectedSourceNode.browserGroupName || '').toLowerCase();
    const pk = (selectedSourceNode.processKind || '').toLowerCase();
    const tm = (selectedSourceNode.tabGroupMode || '').toLowerCase();
    return (
      tm === 'enhance' ||
      pk === 'enhance_images' ||
      t.includes('enhance') ||
      g.includes('enhance')
    );
  }, [selectedSourceNode]);

  const activeHeroImage = useMemo(() => {
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
  }, [isTargetHero, selectedSourceNode, heroNode, effectiveHeroImage, listingCode]);

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

    if (imageSource === 'upload' && box.uploadedImages && box.uploadedImages.length > 0) {
      return box.uploadedImages.map((img: any, idx: number) => ({
        id: img.id || `up-${idx + 1}`,
        index: idx + 1,
        displayNumber: idx + 1,
        url: img.url,
        source: 'upload' as any,
        label: img.name || `Uploaded #${idx + 1}`,
        isEnhanced: false,
      }));
    }

    const isHeroSource =
      imageSource !== 'upload' &&
      (isTargetHero ||
        (!selectedSourceNode && (
          imageSource === 'generate' ||
          (typeof imageSource === 'string' && (imageSource.includes('hero') || imageSource.includes('generator'))) ||
          (!box.imageSource && isHeroCropNode)
        )));

    const isEnhanceSource =
      imageSource !== 'upload' &&
      (isTargetEnhance ||
        (!selectedSourceNode && (
          imageSource === 'enhance' ||
          (typeof imageSource === 'string' && imageSource.includes('enhance')) ||
          (!box.imageSource && isUpstreamEnhance)
        )));

    // 0. Hero / Generator Crop Node: strictly waiting or using generated hero image
    if (isHeroSource) {
      if (activeHeroImage && activeHeroImage.url) {
        const heroNodeLabel = (selectedSourceNode?.title || selectedSourceNode?.browserGroupName || heroLabel || 'Hero').trim();
        return [{
          id: `${selectedSourceNode?.id || 'hero'}-1`,
          index: 1,
          displayNumber: 1,
          url: activeHeroImage.url,
          source: 'generate' as const,
          label: activeHeroImage.condoName ? `${activeHeroImage.condoName} Hero` : `${heroNodeLabel} (1 Photo)`,
        }];
      }
      // If hero image has NOT been generated yet:
      // Strictly wait for Hero image! Do NOT load get_images, do NOT load enhance photos!
      return [];
    }

    // When upstream is an Enhance node, merge with the first step's photos!
    if (isEnhanceSource) {
      const hasEnhanced = Object.keys(enhancedPhotos || {}).length > 0;
      if (!hasEnhanced) {
        return [];
      }
      const enhancedIndices = Object.keys(enhancedPhotos || {}).map(Number).filter((n) => !isNaN(n));
      const maxEnhanced = enhancedIndices.length > 0 ? Math.max(...enhancedIndices) + 1 : 0;
      const totalPhotos = Math.max(images?.length || 0, maxEnhanced);

      for (let idx = 0; idx < totalPhotos; idx++) {
        const photoNum = idx + 1;
        const rawEnhancedUrl =
          (enhancedPhotos as any)?.[idx] ||
          (enhancedPhotos as any)?.[photoNum] ||
          (enhancedPhotos as any)?.[String(idx)] ||
          (enhancedPhotos as any)?.[String(photoNum)];

        // Only include actual enhanced photos! Never fallback to raw un-enhanced photos!
        if (!rawEnhancedUrl) {
          continue;
        }

        let enhancedUrl = String(rawEnhancedUrl);
        if (enhancedUrl.includes('/storage/uploads/facebook-import/enhanced/')) {
          const fname = enhancedUrl.split('/').pop();
          if (fname) enhancedUrl = `http://127.0.0.1:9224/downloaded-image?file=${encodeURIComponent(fname)}`;
        } else if (enhancedUrl.includes('localhost:8085/storage/')) {
          const fname = enhancedUrl.split('/').pop();
          if (fname) enhancedUrl = `http://127.0.0.1:9224/downloaded-image?file=${encodeURIComponent(fname)}`;
        } else if (enhancedUrl.startsWith('/downloaded-image')) {
          enhancedUrl = `http://127.0.0.1:9224${enhancedUrl}`;
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

    // 1. Get Images
    if (!isEnhanceSource && (imageSource === 'get_images' || imageSource === 'all')) {
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

    // 3. Generate Image
    if (!isEnhanceSource && (imageSource as any) === 'all') {
      if (effectiveHeroImage && effectiveHeroImage.url) {
        rawList.push({
          id: 'hero-1',
          index: 999,
          displayNumber: 1,
          url: effectiveHeroImage.url,
          source: 'generate',
          label: effectiveHeroImage.condoName ? `${effectiveHeroImage.condoName} Hero` : `${heroLabel} (1 Photo)`,
        });
      }
    }

    return rawList;
  }, [isHeroCropNode, imageSource, isUpstreamEnhance, images, enhancedPhotos, effectiveHeroImage, heroLabel, watermarkedPhotos, box.imageSource]);

  const [selectedIndices, setSelectedIndices] = useState<number[]>(() => {
    if (Array.isArray(box.selectedImageIndices) && box.selectedImageIndices.length > 0) {
      return box.selectedImageIndices;
    }
    return [];
  });

  useEffect(() => {
    if (currentSourceList.length > 0) {
      const validIndices = selectedIndices.filter((idx) => currentSourceList.some((p) => p.index === idx));
      if (selectedIndices.length === 0 || validIndices.length === 0 || validIndices.length !== selectedIndices.length) {
        const next = validIndices.length > 0 ? validIndices : currentSourceList.map((p) => p.index);
        setSelectedIndices(next);
        onUpdateBox(box.id, { selectedImageIndices: next });
      }
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

  const sourceOptions = useMemo<SelectOption[]>(() => {
    const opts: SelectOption[] = [];
    const hasIncomingHero = connections.some(
      (c) => c.toNodeId === box.id && (c.fromNodeId.includes('hero') || workflowBoxes.some((b) => b.id === c.fromNodeId && (b.title?.toLowerCase().includes('hero') || b.browserGroupName?.toLowerCase().includes('hero'))))
    );
    const hasIncomingEnhance = connections.some(
      (c) => c.toNodeId === box.id && (c.fromNodeId.includes('enhance') || workflowBoxes.some((b) => b.id === c.fromNodeId && (b.title?.toLowerCase().includes('enhance') || b.browserGroupName?.toLowerCase().includes('enhance'))))
    );

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
    } else if (hasIncomingHero || heroNode || isHeroCropNode) {
      const heroCount = (effectiveHeroImage && effectiveHeroImage.url) ? 1 : 0;
      opts.push({
        value: 'generate',
        label: `${heroLabel} (${heroCount > 0 ? `${heroCount} Photo` : 'Waiting for Hero'})`,
      });
    }

    const enhanceNodes = (workflowBoxes || []).filter(
      (b) =>
        b.id !== box.id &&
        !isRunnerBox(b) &&
        (b.tabGroupMode === 'enhance' ||
          b.processKind === 'enhance_images' ||
          b.processType === 'chrome_tab_group' ||
          b.id?.includes('tabgroup') ||
          (b.title?.toLowerCase().includes('enhance') && !b.title?.toLowerCase().includes('crop')) ||
          b.browserGroupName?.toLowerCase().includes('enhance'))
    );

    if (enhanceNodes.length > 0) {
      const enhanceCount = Object.keys(enhancedPhotos || {}).length;
      enhanceNodes.forEach((en) => {
        const title = (en.title || en.browserGroupName || 'Enhance Image').trim();
        opts.push({
          value: enhanceNodes.length === 1 ? 'enhance' : `node:${en.id}`,
          label: `${title} (${enhanceCount > 0 ? `${enhanceCount} Photo${enhanceCount === 1 ? '' : 's'}` : 'Waiting for Enhanced Photos'})`,
        });
      });
    } else if (isUpstreamEnhance || hasIncomingEnhance || enhanceNode) {
      const enhanceCount = Object.keys(enhancedPhotos || {}).length;
      opts.push({
        value: 'enhance',
        label: `${enhanceLabel} (${enhanceCount > 0 ? `${enhanceCount} Photo${enhanceCount === 1 ? '' : 's'}` : 'Waiting for Enhanced Photos'})`,
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

    if (box.uploadedImages && box.uploadedImages.length > 0) {
      opts.push({
        value: 'upload',
        label: `Uploaded Files (${box.uploadedImages.length} ${box.uploadedImages.length === 1 ? 'Photo' : 'Photos'})`,
      });
    }

    return opts;
  }, [connections, box.id, workflowBoxes, heroNode, enhanceNode, isHeroCropNode, heroLabel, enhanceLabel, images.length, enhancedPhotos, isUpstreamEnhance, effectiveHeroImage, box.uploadedImages]);

  const resolvedImageSource = useMemo(() => {
    // 1. Direct match with an option value
    if (sourceOptions.some((opt) => opt.value === imageSource)) {
      return imageSource;
    }
    // 2. If imageSource is 'enhance' or empty, match the enhance option
    if (imageSource === 'enhance' || !imageSource) {
      const enhOpt = sourceOptions.find((opt) => opt.value === 'enhance' || opt.value.includes('enhance') || opt.label.toLowerCase().includes('enhance'));
      if (enhOpt) return enhOpt.value;
    }
    // 3. If imageSource is a node ID (e.g. node:ai-box-tabgroup-...)
    if (imageSource.startsWith('node:')) {
      const targetId = imageSource.replace('node:', '');
      const targetBox = (workflowBoxes || []).find((b: any) => b.id === targetId);
      if (targetBox) {
        const isEnh = targetBox.tabGroupMode === 'enhance' || targetBox.processKind === 'enhance_images' || (targetBox.title || '').toLowerCase().includes('enhance') || (targetBox.browserGroupName || '').toLowerCase().includes('enhance');
        if (isEnh) {
          const enhOpt = sourceOptions.find((opt) => opt.value === 'enhance' || opt.value.includes('enhance') || opt.label.toLowerCase().includes('enhance'));
          if (enhOpt) return enhOpt.value;
        }
        const isHero = targetBox.tabGroupMode === 'generate' || targetBox.processKind === 'generate_image' || (targetBox.title || '').toLowerCase().includes('hero') || (targetBox.browserGroupName || '').toLowerCase().includes('hero');
        if (isHero) {
          const heroOpt = sourceOptions.find((opt) => opt.value === 'generate' || opt.value.includes('hero') || opt.label.toLowerCase().includes('hero'));
          if (heroOpt) return heroOpt.value;
        }
      }
    }
    // 4. If imageSource is 'generate', match hero option
    if (imageSource === 'generate') {
      const heroOpt = sourceOptions.find((opt) => opt.value === 'generate' || opt.value.includes('hero') || opt.label.toLowerCase().includes('hero'));
      if (heroOpt) return heroOpt.value;
    }
    return sourceOptions[0]?.value || 'get_images';
  }, [sourceOptions, imageSource, workflowBoxes]);

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

  const handleSourceChange = (newSource: string) => {
    setImageSource(newSource);
    onUpdateBox(box.id, { imageSource: newSource });
  };

  const handleTitleChange = (val: string) => {
    setNodeTitle(val);
    onUpdateBox(box.id, { title: val, templateText: val });
  };

  const handleDoneAndApply = () => {
    onUpdateBox(box.id, {
      imageSource,
      selectedImageIndices: selectedIndices,
      title: nodeTitle || box.title,
      templateText: nodeTitle || box.title,
      downloadFolder,
    });
    onClose();
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
      className={embedded ? undefined : 'workflow-sidebar'}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={embedded ? {
        width: '100%',
        height: '100%',
        backgroundColor: isDark ? '#25282B' : '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
      } : {
        position: 'fixed',
        top: 0,
        bottom: 0,
        right: '380px', // sits smoothly alongside the 380px main sidebar inspector
        width: '320px',
        maxWidth: 'calc(100vw - 420px)',
        backgroundColor: isDark ? '#25282B' : '#FFFFFF',
        borderLeft: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid var(--border-color)',
        borderRight: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid var(--border-color)',
        boxShadow: isDark ? '-12px 0 35px rgba(0, 0, 0, 0.65)' : '-6px 0 24px rgba(0, 0, 0, 0.08)',
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
          padding: '0 1.125rem',
          height: '62px',
          minHeight: '62px',
          maxHeight: '62px',
          boxSizing: 'border-box',
          flexShrink: 0,
          borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #F1F5F9',
          backgroundColor: isDark ? '#25282B' : '#FFFFFF',
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
      </div>

      {/* ── Scrollable Body ───────────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1rem 1rem 3rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        {/* Node Status Toggle Row */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0 0 12px 0',
            borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid var(--border-color)',
          }}
        >
          <div>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Node Status
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {box.enabled !== false
                ? 'Executing during workflow run'
                : 'Node is bypassed (will skip during workflow run)'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: box.enabled !== false ? '#10B981' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: box.enabled !== false ? '#10B981' : '#6B7280',
                }}
              />
              <span>{box.enabled !== false ? 'Active' : 'Disabled'}</span>
            </span>
            <ToggleSwitch
              checked={box.enabled !== false}
              onChange={() => onUpdateBox(box.id, { enabled: !(box.enabled !== false) })}
              activeColor="#10B981"
              size="md"
            />
          </div>
        </div>
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
                : currentSourceList.length === 0
                ? '0 Photos (Waiting for source)'
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
              value={resolvedImageSource}
              onChange={(val) => handleSourceChange(val as any)}
              height="36px"
              placeholder="Select image source..."
            />
          </div>

          {/* Empty state when upstream node has no photos yet */}
          {currentSourceList.length === 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px 12px',
                borderRadius: '8px',
                border: isDark ? '1px dashed #30363D' : '1px dashed #E2E8F0',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
                gap: '6px',
                marginTop: '4px',
                textAlign: 'center',
              }}
            >
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                No Photos Available
              </span>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                {imageSource === 'enhance' || isUpstreamEnhance
                  ? `The upstream ${enhanceLabel} node has not enhanced photos yet. Run Enhance IMG first.`
                  : imageSource === 'generate'
                  ? `The upstream ${heroLabel} node has not generated a photo yet.`
                  : 'No photos available from Get Images.'}
              </span>
            </div>
          )}

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
                        onError={(e) => {
                          const target = e.currentTarget as HTMLImageElement;
                          if (target.dataset.triedFallback) return;
                          target.dataset.triedFallback = 'true';
                          const currentSrc = target.src;
                          if (currentSrc.includes('/downloaded-image?file=')) {
                            try {
                              const filename = new URL(currentSrc, typeof window !== 'undefined' ? window.location.origin : undefined).searchParams.get('file');
                              if (filename) {
                                target.src = `/storage/uploads/facebook-import/enhanced/${encodeURIComponent(filename)}`;
                                return;
                              }
                            } catch (_) {}
                          } else if (currentSrc.includes('/storage/uploads/facebook-import/enhanced/')) {
                            const filename = currentSrc.split('/').pop();
                            if (filename) {
                              target.src = `http://127.0.0.1:9224/downloaded-image?file=${encodeURIComponent(filename)}`;
                              return;
                            }
                          }
                        }}
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
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
                  color: 'var(--text-primary)',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9';
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
    </div>
  );
};
