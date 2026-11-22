import React, { useState, useMemo, useEffect } from 'react';
import {
  FiLayers,
  FiUpload,
  FiFolder,
  FiCheck,
  FiCheckSquare,
  FiPlus,
  FiMinus,
  FiTrash2,
  FiChevronDown,
  FiX,
  FiImage,
  FiMonitor,
  FiRefreshCw,
} from 'react-icons/fi';
import { ToggleSwitch } from '../../components/ui/ToggleSwitch';
import type { WorkflowImageSource } from './ChromeTabGroupConnectDrawer';
export type { WorkflowImageSource };

export interface AttachmentStep {
  id: string;
  title: string;
  count: number;
  sourceType: 'folder' | 'upload' | 'workflow' | 'enhanced';
  workflowSourceId?: string;
  folderName: string;
  folderImages?: Array<{ filename: string; data_url?: string; full_path?: string; index?: number }>;
  imageSelection?: string;
  uploadedUrls?: string[];
  selectedIndices?: number[];
  enabled: boolean;
}

export interface ResolvedAttachedPhoto {
  index: number;
  filename: string;
  url: string;
  data_url: string;
}

export function resolveAttachedPhotosFromSteps(
  steps: AttachmentStep[],
  workflowImageSources: WorkflowImageSource[] = [],
  propertyImages: Array<{ url: string; index?: number; filename?: string }> = [],
  enhancedImages: Array<{ url: string; index?: number; filename?: string }> = []
): ResolvedAttachedPhoto[] {
  const result: ResolvedAttachedPhoto[] = [];
  if (!Array.isArray(steps)) return result;

  let globalIndex = 1;
  for (const step of steps) {
    if (step.enabled === false) continue;
    const count = Math.max(1, step.count || 1);

    if (step.sourceType === 'upload') {
      const urls = step.uploadedUrls || [];
      if (urls.length > 0) {
        const chosen = (step.selectedIndices && step.selectedIndices.length > 0)
          ? step.selectedIndices.map((idx) => urls[idx]).filter(Boolean)
          : urls.slice(0, count);
        for (let i = 0; i < chosen.length; i++) {
          result.push({
            index: globalIndex++,
            filename: `Upload Photo #${i + 1}`,
            url: chosen[i],
            data_url: chosen[i],
          });
        }
      }
    } else if (step.sourceType === 'folder') {
      const fImgs = step.folderImages || [];
      if (fImgs.length > 0) {
        const chosen = (step.selectedIndices && step.selectedIndices.length > 0)
          ? step.selectedIndices.map((idx) => fImgs[idx]).filter(Boolean)
          : fImgs.slice(0, count);
        for (let i = 0; i < chosen.length; i++) {
          const u = chosen[i].data_url || chosen[i].full_path || '';
          result.push({
            index: globalIndex++,
            filename: chosen[i].filename || `Condo Photo #${i + 1}`,
            url: u,
            data_url: u,
          });
        }
      }
    } else {
      // workflow or enhanced
      const src = (workflowImageSources && workflowImageSources.length > 0)
        ? (workflowImageSources.find((s) => s.id === step.workflowSourceId) || workflowImageSources[0])
        : null;
      const imgs = (src?.images && src.images.length > 0)
        ? src.images
        : (step.workflowSourceId === 'enhanced-images' || step.sourceType === 'enhanced'
          ? (enhancedImages && enhancedImages.length > 0 ? enhancedImages : propertyImages)
          : propertyImages);

      if (imgs && imgs.length > 0) {
        const chosen = (step.selectedIndices && step.selectedIndices.length > 0)
          ? step.selectedIndices.map((idx) => imgs[idx]).filter(Boolean)
          : imgs.slice(0, count);
        for (let i = 0; i < chosen.length; i++) {
          const u = chosen[i].url || (chosen[i] as any).data_url || '';
          result.push({
            index: globalIndex++,
            filename: chosen[i].filename || `Workflow Photo #${i + 1}`,
            url: u,
            data_url: u,
          });
        }
      }
    }
  }

  return result.slice(0, 10);
}

interface AttachmentGroupsManagerProps {
  steps: AttachmentStep[];
  onChange: (steps: AttachmentStep[]) => void;
  isDark: boolean;
  useCondoImages: boolean;
  onToggleUseCondoImages: (enabled: boolean) => void;
  workflowImageSources?: WorkflowImageSource[];
  propertyImages?: Array<{ url: string; index?: number; filename?: string }>;
  enhancedImages?: Array<{ url: string; index?: number; filename?: string }>;
  condoName?: string;
  title?: string;
  subtitle?: string;
  boxless?: boolean;
  hideToggle?: boolean;
  hideAddGroup?: boolean;
  hideDeleteGroup?: boolean;
  isMainBox?: boolean;
}

export const AttachmentGroupsManager: React.FC<AttachmentGroupsManagerProps> = ({
  steps,
  onChange,
  isDark,
  useCondoImages,
  onToggleUseCondoImages,
  workflowImageSources = [],
  propertyImages = [],
  enhancedImages = [],
  condoName = '',
  title = 'Condo Photos',
  subtitle = 'Exterior & facility photos (10 max combined across all groups)',
  boxless = false,
  hideToggle = false,
  hideAddGroup = false,
  hideDeleteGroup = false,
  isMainBox = false,
}) => {
  const [availableCondoFolders, setAvailableCondoFolders] = useState<string[]>([]);
  const [baseCondoDirectory, setBaseCondoDirectory] = useState<string>('/Users/zinwaishine/Desktop/Condo Building');
  const [activeFolderDropdownStepId, setActiveFolderDropdownStepId] = useState<string | null>(null);
  const [activeWorkflowDropdownStepId, setActiveWorkflowDropdownStepId] = useState<string | null>(null);
  const [manualChooseModalStepId, setManualChooseModalStepId] = useState<string | null>(null);
  const [folderSearchFilter, setFolderSearchFilter] = useState<string>('');

  // Resolved workflow sources with fallbacks
  const activeSources = useMemo<WorkflowImageSource[]>(() => {
    if (workflowImageSources && workflowImageSources.length > 0) {
      return workflowImageSources.filter((s) => !s.groupTitle || (!s.title?.toLowerCase().startsWith('external browser') && s.title !== s.groupTitle));
    }
    const defs: WorkflowImageSource[] = [];
    if (propertyImages && propertyImages.length > 0) {
      defs.push({
        id: 'get-images',
        title: 'Get Images (All Media)',
        nodeType: 'get-images',
        images: propertyImages,
        count: propertyImages.length,
        description: `${propertyImages.length} listing photos`,
      });
    }
    defs.push({
      id: 'enhanced-images',
      title: 'Enhance IMG',
      groupTitle: 'External Browser #1',
      nodeType: 'enhance',
      images: enhancedImages && enhancedImages.length > 0 ? enhancedImages : propertyImages,
      count: enhancedImages && enhancedImages.length > 0 ? enhancedImages.length : propertyImages.length,
      description: `${enhancedImages?.length || 0} enhanced photos`,
    });
    defs.push({
      id: 'hero-images',
      title: 'FB Hero',
      groupTitle: 'External Browser #1',
      nodeType: 'hero',
      images: propertyImages.slice(0, 1),
      count: 1,
      description: '1 hero photo',
    });
    return defs;
  }, [workflowImageSources, propertyImages, enhancedImages]);

  // Load available condo folders from companion
  const loadCondoFolders = async (dir: string = baseCondoDirectory) => {
    try {
      const resp = await fetch(`http://127.0.0.1:9224/condo-folders?base_dir=${encodeURIComponent(dir)}`);
      const data = await resp.json();
      if (data?.status === 'success' && Array.isArray(data.folders)) {
        setAvailableCondoFolders(data.folders);
        if (data.base_dir) setBaseCondoDirectory(data.base_dir);
      }
    } catch (_) {}
  };

  const fetchImagesForStep = async (stepId: string, folder: string) => {
    try {
      const resp = await fetch(
        `http://127.0.0.1:9224/condo-images?folder=${encodeURIComponent(folder)}&base_dir=${encodeURIComponent(baseCondoDirectory)}`
      );
      const data = await resp.json();
      if (data?.status === 'success' && Array.isArray(data.images)) {
        handleUpdateStep(stepId, {
          folderImages: data.images.map((im: any, idx: number) => ({
            filename: im.filename || `Photo #${idx + 1}`,
            data_url: im.data_url || '',
            full_path: im.full_path || '',
            index: idx + 1,
          })),
        });
      }
    } catch (_) {}
  };

  useEffect(() => {
    loadCondoFolders();
  }, []);

  // In main box, auto-sync folderName with condoName
  useEffect(() => {
    if (!isMainBox || !condoName) return;
    const trimmedCondo = condoName.trim();
    if (!trimmedCondo) return;
    let changed = false;
    const next = steps.map((s) => {
      if (s.sourceType === 'folder' && s.folderName !== trimmedCondo) {
        changed = true;
        fetchImagesForStep(s.id, trimmedCondo);
        return { ...s, folderName: trimmedCondo };
      }
      return s;
    });
    if (changed) {
      onChange(next);
    }
  }, [isMainBox, condoName]);

  useEffect(() => {
    steps.forEach((s) => {
      if (s.sourceType === 'folder' && s.folderName && (!s.folderImages || s.folderImages.length === 0)) {
        fetchImagesForStep(s.id, s.folderName);
      }
    });
  }, [steps]);

  const filteredCondoFolders = useMemo(() => {
    if (!folderSearchFilter.trim()) return [];
    const q = folderSearchFilter.toLowerCase();
    return availableCondoFolders.filter((f) => f.toLowerCase().includes(q)).slice(0, 25);
  }, [availableCondoFolders, folderSearchFilter]);

  const totalCondoImagesCount = useMemo(() => {
    return steps.filter((s) => s.enabled).reduce((acc, s) => acc + s.count, 0);
  }, [steps]);

  const handleUpdateStep = (id: string, updates: Partial<AttachmentStep>) => {
    onChange(steps.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const handleAddStep = () => {
    const nextIdx = steps.length + 1;
    const remaining = Math.max(1, 10 - totalCondoImagesCount);
    const newStepId = `group-${Date.now()}`;
    const initialFolder = condoName || availableCondoFolders[0] || '';

    const newStep: AttachmentStep = {
      id: newStepId,
      title: `Group ${nextIdx}`,
      count: Math.min(remaining, 1),
      sourceType: 'upload',
      workflowSourceId: activeSources[0]?.id || 'get-images',
      folderName: initialFolder,
      imageSelection: '',
      enabled: true,
    };
    onChange([...steps, newStep]);
    if (initialFolder) {
      fetchImagesForStep(newStepId, initialFolder);
    }
  };

  const handleRemoveStep = (id: string) => {
    onChange(steps.filter((s) => s.id !== id));
  };

  const renderCountStepper = (s: AttachmentStep) => {
    if (isMainBox) return null;
    const otherGroupsCount = steps
      .filter((other) => other.id !== s.id && other.enabled)
      .reduce((acc, other) => acc + other.count, 0);
    const maxAllowed = Math.max(1, 10 - otherGroupsCount);
    const isAtMax = s.count >= maxAllowed;

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
        <span style={{ fontSize: '0.625rem', color: isDark ? '#8B949E' : '#64748B' }}>Attach:</span>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            backgroundColor: isDark ? '#161B22' : '#FFFFFF',
            borderRadius: '4px',
            border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
            height: '24px',
            padding: '0 2px',
          }}
        >
          <button
            type="button"
            disabled={s.count <= 1}
            onClick={() => {
              const newCount = Math.max(1, s.count - 1);
              const updates: any = { count: newCount };
              if (s.selectedIndices && s.selectedIndices.length > 0) {
                updates.selectedIndices = s.selectedIndices.slice(0, newCount);
              }
              handleUpdateStep(s.id, updates);
            }}
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '3px',
              border: 'none',
              backgroundColor: 'transparent',
              color: s.count <= 1 ? (isDark ? '#484F58' : '#94A3B8') : (isDark ? '#C9D1D9' : '#334155'),
              cursor: s.count <= 1 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          >
            <FiMinus size={10} />
          </button>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={s.count}
            onChange={(e) => {
              const val = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10);
              const newCount = isNaN(val) ? 1 : Math.min(maxAllowed, Math.max(1, val));
              const updates: any = { count: newCount };
              if (s.selectedIndices && s.selectedIndices.length > 0) {
                updates.selectedIndices = s.selectedIndices.slice(0, newCount);
              }
              handleUpdateStep(s.id, updates);
            }}
            style={{
              width: '22px',
              height: '20px',
              textAlign: 'center',
              border: 'none',
              backgroundColor: 'transparent',
              color: isDark ? '#F0F6FC' : '#0F172A',
              fontSize: '0.75rem',
              fontWeight: 600,
              outline: 'none',
              padding: 0,
              margin: 0,
            }}
          />
          <button
            type="button"
            disabled={isAtMax}
            onClick={() => {
              if (s.count < maxAllowed) {
                const newCount = s.count + 1;
                const updates: any = { count: newCount };
                if (s.selectedIndices && s.selectedIndices.length > 0) {
                  const allIdxs = Array.from({ length: 25 }, (_, i) => i);
                  const nextUnselected = allIdxs.find((idx) => !s.selectedIndices!.includes(idx));
                  if (nextUnselected !== undefined) {
                    updates.selectedIndices = [...s.selectedIndices, nextUnselected];
                  }
                }
                handleUpdateStep(s.id, updates);
              }
            }}
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '3px',
              border: 'none',
              backgroundColor: 'transparent',
              color: isAtMax ? (isDark ? '#484F58' : '#94A3B8') : (isDark ? '#C9D1D9' : '#334155'),
              cursor: isAtMax ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          >
            <FiPlus size={10} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div
      style={
        boxless
          ? {
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }
          : {
              borderRadius: '12px',
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#FFFFFF',
              border: '1px solid var(--border-color)',
              boxShadow: isDark ? '0 1px 3px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.05)',
              padding: '0.875rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }
      }
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: boxless ? '8px' : '9px' }}>
          {boxless ? (
            <FiFolder size={15} style={{ color: isDark ? '#8B949E' : '#64748B', flexShrink: 0 }} />
          ) : (
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
          )}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: isDark ? '#F0F6FC' : '#0F172A' }}>
                {title}
              </span>
              <span
                style={{
                  fontSize: '0.59375rem',
                  fontWeight: 600,
                  padding: '1px 6px',
                  borderRadius: '10px',
                  backgroundColor: totalCondoImagesCount > 0
                    ? (isDark ? 'rgba(88, 166, 255, 0.1)' : '#EFF6FF')
                    : (isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9'),
                  color: totalCondoImagesCount > 0 ? (isDark ? '#58A6FF' : '#2563EB') : 'var(--text-muted)',
                  border: isDark ? '1px solid rgba(88, 166, 255, 0.3)' : '1px solid #CBD5E1',
                }}
              >
                {totalCondoImagesCount}/10 Total
              </span>
            </div>
            <div style={{ fontSize: '0.625rem', color: isDark ? '#8B949E' : '#64748B' }}>
              {subtitle}
            </div>
          </div>
        </div>
        {!hideToggle && (
          <ToggleSwitch checked={useCondoImages} onChange={onToggleUseCondoImages} size="sm" activeColor="#2563EB" />
        )}
      </div>

      {(hideToggle || useCondoImages) && (
        <div style={{ paddingLeft: boxless ? '23px' : '0px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {steps.map((step, sIdx) => {
            const selectedSource = activeSources.find((s) => s.id === step.workflowSourceId) || activeSources[0];
            const sourceImages = selectedSource?.images && selectedSource.images.length > 0
              ? selectedSource.images
              : (selectedSource?.nodeType === 'enhance' ? enhancedImages : propertyImages);

            return (
              <div
                key={step.id}
                style={{
                  borderRadius: '6px',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid #E2E8F0',
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.025)' : '#F8FAFC',
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                {/* Group Top Bar: Title + Source Selector + Trash */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.71875rem', fontWeight: 600, color: isDark ? '#F0F6FC' : '#0F172A' }}>
                    Group {sIdx + 1}
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {/* Source Selector Tabs / Badge */}
                    {isMainBox ? (
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.625rem',
                          fontWeight: 600,
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#E2E8F0',
                          color: isDark ? '#C9D1D9' : '#334155',
                        }}
                      >
                        {step.sourceType === 'folder' ? 'Folder' : step.sourceType === 'upload' ? 'Upload' : 'Workflow'}
                      </span>
                    ) : (
                      <div
                        style={{
                          display: 'inline-flex',
                          padding: '1px',
                          borderRadius: '4px',
                          backgroundColor: isDark ? '#0D1117' : '#E2E8F0',
                        }}
                      >
                        {(['folder', 'upload', 'workflow'] as const).map((st) => {
                          const isCurrent = step.sourceType === st;
                          const label = st === 'folder' ? 'Folder' : st === 'upload' ? 'Upload' : 'Workflow';
                          return (
                            <button
                              key={st}
                              type="button"
                              onClick={() => handleUpdateStep(step.id, { sourceType: st })}
                              style={{
                                padding: '2px 8px',
                                borderRadius: '3px',
                                border: 'none',
                                fontSize: '0.625rem',
                                fontWeight: isCurrent ? 600 : 400,
                                backgroundColor: isCurrent ? (isDark ? '#21262D' : '#FFFFFF') : 'transparent',
                                color: isCurrent ? (isDark ? '#F0F6FC' : '#0F172A') : (isDark ? '#8B949E' : '#64748B'),
                                cursor: 'pointer',
                              }}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {!hideDeleteGroup && steps.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveStep(step.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: isDark ? '#8B949E' : '#64748B',
                          cursor: 'pointer',
                          padding: '2px',
                        }}
                      >
                        <FiTrash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Source 1: Folder */}
                {step.sourceType === 'folder' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {isMainBox ? (
                        <div
                          style={{
                            flex: 1,
                            height: '26px',
                            padding: '0 8px',
                            borderRadius: '4px',
                            border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #CBD5E1',
                            backgroundColor: isDark ? '#0D1117' : '#FFFFFF',
                            color: isDark ? '#F0F6FC' : '#0F172A',
                            fontSize: '0.65625rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            overflow: 'hidden',
                          }}
                        >
                          <FiFolder size={11} style={{ color: '#58A6FF', flexShrink: 0 }} />
                          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontWeight: 500 }}>
                            {condoName || step.folderName || 'Condo Building'}
                          </span>
                        </div>
                      ) : (
                        <div style={{ position: 'relative', flex: 1 }}>
                          <button
                            type="button"
                            onClick={() => setActiveFolderDropdownStepId(activeFolderDropdownStepId === step.id ? null : step.id)}
                            style={{
                              width: '100%',
                              height: '26px',
                              padding: '0 8px',
                              borderRadius: '4px',
                              border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                              backgroundColor: isDark ? '#0D1117' : '#FFFFFF',
                              color: isDark ? '#F0F6FC' : '#0F172A',
                              fontSize: '0.65625rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                              <FiFolder size={11} style={{ color: '#58A6FF', flexShrink: 0 }} />
                              <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                {step.folderName || 'Select folder...'}
                              </span>
                            </div>
                            <FiChevronDown size={11} style={{ color: isDark ? '#8B949E' : '#64748B' }} />
                          </button>

                          {activeFolderDropdownStepId === step.id && (
                            <>
                              <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setActiveFolderDropdownStepId(null)} />
                              <div
                                style={{
                                  position: 'absolute',
                                  top: '29px',
                                  left: 0,
                                  right: 0,
                                  zIndex: 50,
                                  maxHeight: '160px',
                                  overflowY: 'auto',
                                  borderRadius: '4px',
                                  border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                                  backgroundColor: isDark ? '#161B22' : '#FFFFFF',
                                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                                  padding: '4px',
                                }}
                              >
                                <input
                                  type="text"
                                  placeholder="Search folders..."
                                  value={folderSearchFilter}
                                  onChange={(e) => setFolderSearchFilter(e.target.value)}
                                  style={{
                                    width: '100%',
                                    height: '24px',
                                    padding: '0 6px',
                                    borderRadius: '3px',
                                    border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                                    backgroundColor: isDark ? '#0D1117' : '#F8FAFC',
                                    color: isDark ? '#F0F6FC' : '#0F172A',
                                    fontSize: '0.625rem',
                                    marginBottom: '4px',
                                    outline: 'none',
                                  }}
                                />
                                {(filteredCondoFolders.length > 0 ? filteredCondoFolders : availableCondoFolders.slice(0, 20)).map((f) => (
                                  <button
                                    key={f}
                                    type="button"
                                    onClick={() => {
                                      handleUpdateStep(step.id, { folderName: f });
                                      fetchImagesForStep(step.id, f);
                                      setActiveFolderDropdownStepId(null);
                                    }}
                                    style={{
                                      width: '100%',
                                      height: '24px',
                                      padding: '0 6px',
                                      borderRadius: '3px',
                                      border: 'none',
                                      backgroundColor: step.folderName === f ? (isDark ? '#21262D' : '#E2E8F0') : 'transparent',
                                      color: isDark ? '#F0F6FC' : '#0F172A',
                                      fontSize: '0.625rem',
                                      textAlign: 'left',
                                      cursor: 'pointer',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {f}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          const target = (condoName || step.folderName || '').trim();
                          if (target) {
                            fetchImagesForStep(step.id, target);
                          } else {
                            loadCondoFolders();
                          }
                        }}
                        title="Reload folder photos"
                        style={{
                          height: '26px',
                          padding: '0 8px',
                          borderRadius: '4px',
                          border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                          backgroundColor: isDark ? '#0D1117' : '#FFFFFF',
                          color: isDark ? '#8B949E' : '#64748B',
                          cursor: 'pointer',
                        }}
                      >
                        <FiRefreshCw size={11} />
                      </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.625rem', color: isDark ? '#8B949E' : '#64748B' }}>
                        Found {step.folderImages?.length || 0} photos in {condoName || step.folderName || 'folder'}
                      </span>
                      {renderCountStepper(step)}
                    </div>

                    {step.folderImages && step.folderImages.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', overflowX: 'auto', padding: '2px 0' }}>
                        {step.folderImages.slice(0, 10).map((img, idx) => {
                          const isSel = idx < step.count;
                          return (
                            <div
                              key={idx}
                              onClick={() => handleUpdateStep(step.id, { count: idx + 1 })}
                              style={{
                                width: '38px',
                                height: '38px',
                                borderRadius: '4px',
                                border: isSel ? '1.5px solid #58A6FF' : (isDark ? '1px dashed #30363D' : '1px dashed #CBD5E1'),
                                opacity: isSel ? 1 : 0.4,
                                overflow: 'hidden',
                                position: 'relative',
                                flexShrink: 0,
                                cursor: 'pointer',
                                backgroundColor: isDark ? '#0D1117' : '#F1F5F9',
                              }}
                            >
                              {img.data_url ? (
                                <img src={img.data_url} alt={`#${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <FiImage size={11} color={isDark ? '#8B949E' : '#64748B'} />
                                </div>
                              )}
                              <span
                                style={{
                                  position: 'absolute',
                                  bottom: 1,
                                  right: 1,
                                  backgroundColor: isSel ? 'rgba(37,99,235,0.85)' : 'rgba(0,0,0,0.65)',
                                  color: '#fff',
                                  fontSize: '7px',
                                  fontWeight: 600,
                                  padding: '1px 3px',
                                  borderRadius: '2px',
                                }}
                              >
                                {isSel ? `✓ #${idx + 1}` : `#${idx + 1}`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Source 2: Upload */}
                {step.sourceType === 'upload' && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label
                        style={{
                          height: '26px',
                          padding: '0 8px',
                          borderRadius: '4px',
                          border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                          backgroundColor: isDark ? '#0D1117' : '#FFFFFF',
                          color: isDark ? '#F0F6FC' : '#0F172A',
                          fontSize: '0.625rem',
                          fontWeight: 500,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <FiUpload size={11} style={{ color: '#58A6FF' }} />
                        <span>{step.uploadedUrls?.length ? `${step.uploadedUrls.length}/${step.count} Selected` : 'Choose Files'}</span>
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            if (files.length === 0) return;
                            const urls: string[] = [];
                            let readCount = 0;
                            files.slice(0, step.count).forEach((f) => {
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                if (ev.target?.result) urls.push(ev.target.result as string);
                                readCount++;
                                if (readCount === Math.min(files.length, step.count)) {
                                  handleUpdateStep(step.id, { uploadedUrls: urls });
                                }
                              };
                              reader.readAsDataURL(f);
                            });
                          }}
                        />
                      </label>
                      <span style={{ fontSize: '0.625rem', color: isDark ? '#8B949E' : '#64748B' }}>
                        Max {step.count} image(s)
                      </span>
                    </div>
                    {renderCountStepper(step)}
                  </div>
                )}

                {/* Source 3: Workflow */}
                {(step.sourceType === 'workflow' || step.sourceType === 'enhanced') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {/* Workflow Source Selector */}
                    {isMainBox ? (
                      <div
                        style={{
                          width: '100%',
                          height: '26px',
                          padding: '0 8px',
                          borderRadius: '4px',
                          border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #CBD5E1',
                          backgroundColor: isDark ? '#0D1117' : '#FFFFFF',
                          color: isDark ? '#F0F6FC' : '#0F172A',
                          fontSize: '0.65625rem',
                          fontWeight: 500,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                          <FiLayers size={11} style={{ color: '#58A6FF', flexShrink: 0 }} />
                          <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {selectedSource?.title || 'Select workflow source...'}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: '0.5625rem',
                            padding: '1px 5px',
                            borderRadius: '8px',
                            backgroundColor: isDark ? '#21262D' : '#F1F5F9',
                            color: isDark ? '#8B949E' : '#64748B',
                            border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                          }}
                        >
                          {sourceImages.length} photo{sourceImages.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    ) : (
                      <div style={{ position: 'relative' }}>
                        <button
                          type="button"
                          onClick={() => setActiveWorkflowDropdownStepId(activeWorkflowDropdownStepId === step.id ? null : step.id)}
                          style={{
                            width: '100%',
                            height: '26px',
                            padding: '0 8px',
                            borderRadius: '4px',
                            border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                            backgroundColor: isDark ? '#0D1117' : '#FFFFFF',
                            color: isDark ? '#F0F6FC' : '#0F172A',
                            fontSize: '0.65625rem',
                            fontWeight: 500,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                            <FiLayers size={11} style={{ color: '#58A6FF', flexShrink: 0 }} />
                            <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {selectedSource?.title || 'Select workflow source...'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span
                              style={{
                                fontSize: '0.5625rem',
                                padding: '1px 5px',
                                borderRadius: '8px',
                                backgroundColor: isDark ? '#21262D' : '#F1F5F9',
                                color: isDark ? '#8B949E' : '#64748B',
                                border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                              }}
                            >
                              {sourceImages.length} photo{sourceImages.length !== 1 ? 's' : ''}
                            </span>
                            <FiChevronDown size={11} style={{ color: isDark ? '#8B949E' : '#64748B' }} />
                          </div>
                        </button>

                        {activeWorkflowDropdownStepId === step.id && (
                          <>
                            <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setActiveWorkflowDropdownStepId(null)} />
                            <div
                              style={{
                                position: 'absolute',
                                top: '29px',
                                left: 0,
                                right: 0,
                                zIndex: 50,
                                maxHeight: '170px',
                                overflowY: 'auto',
                                borderRadius: '5px',
                                border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                                backgroundColor: isDark ? '#161B22' : '#FFFFFF',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                                padding: '4px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '2px',
                              }}
                            >
                              {(() => {
                                const rootSources = activeSources.filter((s) => !s.groupTitle);
                                const groupedMap: Record<string, WorkflowImageSource[]> = {};
                                activeSources
                                  .filter((s) => s.groupTitle && s.title !== s.groupTitle && !s.title?.toLowerCase().startsWith('external browser'))
                                  .forEach((s) => {
                                    const g = s.groupTitle!;
                                    if (!groupedMap[g]) groupedMap[g] = [];
                                    groupedMap[g].push(s);
                                  });

                                const renderSourceBtn = (src: WorkflowImageSource, isIndented = false) => {
                                  const isCurrent = src.id === selectedSource?.id;
                                  const count = src.images?.length ?? src.count ?? 0;
                                  return (
                                    <button
                                      key={src.id}
                                      type="button"
                                      onClick={() => {
                                        handleUpdateStep(step.id, { workflowSourceId: src.id });
                                        setActiveWorkflowDropdownStepId(null);
                                      }}
                                      style={{
                                        width: '100%',
                                        height: '25px',
                                        padding: isIndented ? '0 8px 0 18px' : '0 8px',
                                        borderRadius: '3px',
                                        border: 'none',
                                        backgroundColor: isCurrent ? (isDark ? '#21262D' : '#E2E8F0') : 'transparent',
                                        color: isCurrent ? (isDark ? '#F0F6FC' : '#0F172A') : (isDark ? '#C9D1D9' : '#334155'),
                                        fontSize: '0.65625rem',
                                        fontWeight: isCurrent ? 600 : 400,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                                        <FiLayers size={11} style={{ color: isCurrent ? '#58A6FF' : (isDark ? '#8B949E' : '#64748B') }} />
                                        <span>{src.title}</span>
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontSize: '0.59375rem', color: isDark ? '#8B949E' : '#64748B' }}>
                                          {count} photo{count !== 1 ? 's' : ''}
                                        </span>
                                        {isCurrent && <FiCheck size={11} style={{ color: '#58A6FF' }} />}
                                      </div>
                                    </button>
                                  );
                                };

                                return (
                                  <>
                                    {rootSources.map((src) => renderSourceBtn(src, false))}
                                    {Object.entries(groupedMap).map(([groupTitle, items]) => (
                                      <div key={`group-${groupTitle}`} style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                        <div
                                          style={{
                                            padding: '5px 8px 3px 8px',
                                            marginTop: '3px',
                                            marginBottom: '1px',
                                            borderTop: isDark ? '1px solid #21262D' : '1px solid #F1F5F9',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                          }}
                                        >
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <FiMonitor size={11} style={{ color: '#06B6D4' }} />
                                            <span style={{ fontSize: '0.625rem', fontWeight: 600, color: isDark ? '#E6EDF3' : '#1E293B' }}>
                                              {groupTitle}
                                            </span>
                                          </div>
                                          <span
                                            style={{
                                              fontSize: '0.5rem',
                                              fontWeight: 600,
                                              padding: '1px 4px',
                                              borderRadius: '3px',
                                              backgroundColor: isDark ? '#21262D' : '#F1F5F9',
                                              color: isDark ? '#8B949E' : '#64748B',
                                              textTransform: 'uppercase',
                                            }}
                                          >
                                            Main Box
                                          </span>
                                        </div>
                                        {items.map((src) => renderSourceBtn(src, true))}
                                      </div>
                                    ))}
                                  </>
                                );
                              })()}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Sub-bar with count & Manual Choose button */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                        <span style={{ fontSize: '0.625rem', color: isDark ? '#8B949E' : '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {sourceImages.length > 0
                            ? `Found ${sourceImages.length} photo${sourceImages.length !== 1 ? 's' : ''} in ${selectedSource?.title || 'Workflow'}`
                            : `Pulling from ${selectedSource?.title || 'Workflow'}`}
                        </span>
                        {sourceImages.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setManualChooseModalStepId(step.id)}
                            style={{
                              padding: '2px 7px',
                              borderRadius: '3px',
                              fontSize: '0.59375rem',
                              fontWeight: 600,
                              border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                              backgroundColor: (step.selectedIndices && step.selectedIndices.length > 0)
                                ? (isDark ? '#1F3554' : '#DBEAFE')
                                : (isDark ? '#21262D' : '#F1F5F9'),
                              color: (step.selectedIndices && step.selectedIndices.length > 0)
                                ? '#58A6FF'
                                : (isDark ? '#C9D1D9' : '#475569'),
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              flexShrink: 0,
                            }}
                          >
                            <FiCheckSquare size={11} />
                            <span>
                              {step.selectedIndices && step.selectedIndices.length > 0
                                ? `Manual: ${step.selectedIndices.length} Chosen`
                                : 'Manual Choose'}
                            </span>
                          </button>
                        )}
                      </div>
                      {renderCountStepper(step)}
                    </div>

                    {/* Thumbnail carousel with toggleable selection */}
                    {sourceImages && sourceImages.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', padding: '2px 0' }}>
                        {sourceImages.slice(0, 15).map((img: any, tIdx: number) => {
                          const isSelected = step.selectedIndices && step.selectedIndices.length > 0
                            ? step.selectedIndices.includes(tIdx)
                            : tIdx < step.count;
                          const selectionIndex = step.selectedIndices && step.selectedIndices.length > 0
                            ? step.selectedIndices.indexOf(tIdx) + 1
                            : (tIdx < step.count ? tIdx + 1 : null);

                          return (
                            <div
                              key={tIdx}
                              onClick={() => {
                                const otherGroupsCount = steps
                                  .filter((other) => other.id !== step.id && other.enabled)
                                  .reduce((acc, other) => acc + other.count, 0);
                                const maxAllowed = Math.max(1, 10 - otherGroupsCount);

                                let currentSelected = step.selectedIndices
                                  ? [...step.selectedIndices]
                                  : Array.from({ length: Math.min(step.count, sourceImages.length) }, (_, i) => i);

                                if (currentSelected.includes(tIdx)) {
                                  if (currentSelected.length > 1) {
                                    currentSelected = currentSelected.filter((idx) => idx !== tIdx);
                                  }
                                } else {
                                  if (currentSelected.length < maxAllowed) {
                                    currentSelected.push(tIdx);
                                  }
                                }

                                handleUpdateStep(step.id, {
                                  selectedIndices: currentSelected,
                                  count: currentSelected.length,
                                });
                              }}
                              style={{
                                width: '42px',
                                height: '42px',
                                borderRadius: '4px',
                                border: isSelected ? '1.5px solid #58A6FF' : (isDark ? '1px dashed #30363D' : '1px dashed #CBD5E1'),
                                opacity: isSelected ? 1 : 0.4,
                                overflow: 'hidden',
                                position: 'relative',
                                flexShrink: 0,
                                cursor: 'pointer',
                                backgroundColor: isDark ? '#0D1117' : '#F1F5F9',
                              }}
                            >
                              {img.url ? (
                                <img src={img.url} alt={`#${tIdx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <FiImage size={12} color={isDark ? '#8B949E' : '#64748B'} />
                                </div>
                              )}
                              <span
                                style={{
                                  position: 'absolute',
                                  bottom: 1,
                                  right: 1,
                                  backgroundColor: isSelected ? 'rgba(37,99,235,0.85)' : 'rgba(0,0,0,0.65)',
                                  color: '#fff',
                                  fontSize: '7px',
                                  fontWeight: 600,
                                  padding: '1px 3px',
                                  borderRadius: '2px',
                                }}
                              >
                                {isSelected ? `✓ #${selectionIndex}` : `#${tIdx + 1}`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Add Group Button */}
          {!hideAddGroup && (
            <button
              type="button"
              disabled={totalCondoImagesCount >= 10}
              onClick={handleAddStep}
              style={{
                height: '28px',
                borderRadius: '5px',
                border: isDark ? '1px dashed #30363D' : '1px dashed #CBD5E1',
                backgroundColor: 'transparent',
                color: totalCondoImagesCount >= 10 ? (isDark ? '#484F58' : '#94A3B8') : (isDark ? '#8B949E' : '#64748B'),
                fontSize: '0.65625rem',
                fontWeight: 500,
                cursor: totalCondoImagesCount >= 10 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <FiPlus size={11} />
              <span>Add Group ({steps.length + 1})</span>
            </button>
          )}
        </div>
      )}

      {/* Manual Choose Modal */}
      {manualChooseModalStepId && (() => {
        const modalStep = steps.find((s) => s.id === manualChooseModalStepId);
        if (!modalStep) return null;
        const selectedSrc = activeSources.find((s) => s.id === modalStep.workflowSourceId) || activeSources[0];
        const imagesList = selectedSrc?.images && selectedSrc.images.length > 0
          ? selectedSrc.images
          : (selectedSrc?.nodeType === 'enhance' ? enhancedImages : propertyImages);

        const otherGroupsCount = steps
          .filter((o) => o.id !== modalStep.id && o.enabled)
          .reduce((acc, o) => acc + o.count, 0);
        const maxAllowed = Math.max(1, 10 - otherGroupsCount);

        const currentSelected = modalStep.selectedIndices && modalStep.selectedIndices.length > 0
          ? [...modalStep.selectedIndices]
          : Array.from({ length: Math.min(modalStep.count, imagesList.length) }, (_, i) => i);

        return (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 100,
              backgroundColor: 'rgba(0,0,0,0.7)',
              backdropFilter: 'blur(3px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
            }}
            onClick={() => setManualChooseModalStepId(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '540px',
                maxWidth: '92vw',
                maxHeight: '85vh',
                backgroundColor: isDark ? '#161B22' : '#FFFFFF',
                borderRadius: '8px',
                border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {/* Modal Header */}
              <div
                style={{
                  padding: '12px 16px',
                  borderBottom: isDark ? '1px solid #21262D' : '1px solid #E2E8F0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FiCheckSquare size={16} style={{ color: '#58A6FF' }} />
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: isDark ? '#F0F6FC' : '#0F172A' }}>
                      Manual Choose Photos
                    </div>
                    <div style={{ fontSize: '0.625rem', color: isDark ? '#8B949E' : '#64748B' }}>
                      Select up to {maxAllowed} images from {selectedSrc?.title || 'Workflow'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setManualChooseModalStepId(null)}
                  style={{ background: 'transparent', border: 'none', color: isDark ? '#8B949E' : '#64748B', cursor: 'pointer', padding: '4px' }}
                >
                  <FiX size={16} />
                </button>
              </div>

              {/* Action Toolbar */}
              <div
                style={{
                  padding: '8px 16px',
                  backgroundColor: isDark ? '#0D1117' : '#F8FAFC',
                  borderBottom: isDark ? '1px solid #21262D' : '1px solid #E2E8F0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontSize: '0.6875rem', fontWeight: 500, color: isDark ? '#C9D1D9' : '#334155' }}>
                  Selected: <strong style={{ color: '#58A6FF' }}>{currentSelected.length}</strong> / {maxAllowed} max
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const firstN = Array.from({ length: Math.min(modalStep.count, imagesList.length) }, (_, i) => i);
                      handleUpdateStep(modalStep.id, { selectedIndices: firstN, count: firstN.length });
                    }}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                      backgroundColor: isDark ? '#21262D' : '#FFFFFF',
                      color: isDark ? '#C9D1D9' : '#334155',
                      fontSize: '0.625rem',
                      cursor: 'pointer',
                    }}
                  >
                    Select First {modalStep.count}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const all = Array.from({ length: Math.min(maxAllowed, imagesList.length) }, (_, i) => i);
                      handleUpdateStep(modalStep.id, { selectedIndices: all, count: all.length });
                    }}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                      backgroundColor: isDark ? '#21262D' : '#FFFFFF',
                      color: isDark ? '#C9D1D9' : '#334155',
                      fontSize: '0.625rem',
                      cursor: 'pointer',
                    }}
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateStep(modalStep.id, { selectedIndices: [0], count: 1 })}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                      backgroundColor: isDark ? '#21262D' : '#FFFFFF',
                      color: isDark ? '#C9D1D9' : '#334155',
                      fontSize: '0.625rem',
                      cursor: 'pointer',
                    }}
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* Grid of photos */}
              <div
                style={{
                  padding: '16px',
                  overflowY: 'auto',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
                  gap: '10px',
                  flex: 1,
                  maxHeight: '400px',
                }}
              >
                {imagesList.map((img: any, idx: number) => {
                  const isChosen = currentSelected.includes(idx);
                  const orderNum = currentSelected.indexOf(idx) + 1;
                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        let updated = [...currentSelected];
                        if (isChosen) {
                          if (updated.length > 1) {
                            updated = updated.filter((i) => i !== idx);
                          }
                        } else {
                          if (updated.length < maxAllowed) {
                            updated.push(idx);
                          }
                        }
                        handleUpdateStep(modalStep.id, { selectedIndices: updated, count: updated.length });
                      }}
                      style={{
                        aspectRatio: '1',
                        borderRadius: '6px',
                        border: isChosen ? '2px solid #58A6FF' : (isDark ? '1px solid #30363D' : '1px solid #CBD5E1'),
                        opacity: isChosen ? 1 : 0.5,
                        overflow: 'hidden',
                        position: 'relative',
                        cursor: 'pointer',
                        backgroundColor: isDark ? '#0D1117' : '#F1F5F9',
                      }}
                    >
                      {img.url ? (
                        <img src={img.url} alt={`Photo #${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FiImage size={20} color={isDark ? '#8B949E' : '#64748B'} />
                        </div>
                      )}
                      <div
                        style={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          width: '18px',
                          height: '18px',
                          borderRadius: '4px',
                          backgroundColor: isChosen ? '#2563EB' : 'rgba(0,0,0,0.5)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontSize: '10px',
                          fontWeight: 700,
                        }}
                      >
                        {isChosen ? '✓' : ''}
                      </div>
                      <span
                        style={{
                          position: 'absolute',
                          bottom: 3,
                          left: 3,
                          backgroundColor: 'rgba(0,0,0,0.7)',
                          color: '#fff',
                          fontSize: '8px',
                          padding: '1px 4px',
                          borderRadius: '2px',
                          fontWeight: 600,
                        }}
                      >
                        {isChosen ? `#${orderNum} (Img ${idx + 1})` : `Img #${idx + 1}`}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  padding: '10px 16px',
                  borderTop: isDark ? '1px solid #21262D' : '1px solid #E2E8F0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                }}
              >
                <button
                  type="button"
                  onClick={() => setManualChooseModalStepId(null)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '4px',
                    backgroundColor: '#2563EB',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Done ({currentSelected.length} Photos Selected)
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
