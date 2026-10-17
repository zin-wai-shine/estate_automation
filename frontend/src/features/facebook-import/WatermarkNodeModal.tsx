import React, { useState, useMemo } from 'react';
import {
  FiShield,
  FiCheck,
  FiTrash2,
  FiLayers,
  FiImage,
  FiSliders,
} from 'react-icons/fi';
import {
  type WatermarkConfig,
  type WatermarkPosition,
  type WatermarkPreset,
  DEFAULT_WATERMARK_CONFIG,
  DEFAULT_PRESETS,
  loadWatermarkPresets,
} from '../autopost/watermarkStorage';
import type { DynamicAIBoxConfig } from './FacebookWorkflowCanvas';
import { Button } from '../../components/ui/Button';

interface WatermarkNodeModalProps {
  box: DynamicAIBoxConfig;
  isDark: boolean;
  onUpdateBox: (id: string, updates: Partial<DynamicAIBoxConfig>) => void;
  onDeleteBox: (id: string) => void;
  onClose: () => void;
}

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

// Clean sample condo backdrop for live real-time watermark placement preview
const SAMPLE_PREVIEW_PHOTO = `data:image/svg+xml;utf8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="800" height="500">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1E293B" />
        <stop offset="50%" stop-color="#0F172A" />
        <stop offset="100%" stop-color="#020617" />
      </linearGradient>
      <linearGradient id="windowLight" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#38BDF8" stop-opacity="0.3" />
        <stop offset="100%" stop-color="#1E3A8A" stop-opacity="0.1" />
      </linearGradient>
    </defs>
    <rect width="800" height="500" fill="url(#bgGrad)" />
    <!-- Floor & Walls -->
    <polygon points="0,380 800,380 800,500 0,500" fill="#0F172A" opacity="0.9" />
    <line x1="0" y1="380" x2="800" y2="380" stroke="rgba(255,255,255,0.1)" stroke-width="1.5" />
    <!-- City Skyline Window -->
    <rect x="80" y="50" width="360" height="280" rx="8" fill="url(#windowLight)" stroke="rgba(255,255,255,0.18)" stroke-width="2" />
    <line x1="260" y1="50" x2="260" y2="330" stroke="rgba(255,255,255,0.2)" stroke-width="2" />
    <line x1="80" y1="190" x2="440" y2="190" stroke="rgba(255,255,255,0.2)" stroke-width="2" />
    <!-- Modern Sofa -->
    <rect x="420" y="310" width="310" height="110" rx="16" fill="#334155" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" />
    <rect x="440" y="330" width="130" height="70" rx="10" fill="#475569" />
    <rect x="580" y="330" width="130" height="70" rx="10" fill="#475569" />
    <!-- Luxury Label -->
    <text x="400" y="475" font-family="-apple-system, sans-serif" font-size="14" font-weight="600" fill="rgba(255,255,255,0.4)" text-anchor="middle" letter-spacing="3">SAMPLE PROPERTY PHOTO · 800×500</text>
  </svg>
`)}`;

export const WatermarkNodeModal: React.FC<WatermarkNodeModalProps> = ({
  box,
  isDark,
  onUpdateBox,
  onDeleteBox,
  onClose,
}) => {
  const presets: WatermarkPreset[] = useMemo(() => {
    const list = loadWatermarkPresets();
    return list && list.length > 0 ? list : DEFAULT_PRESETS;
  }, []);

  const [selectedPresetId, setSelectedPresetId] = useState<string>(() => {
    return box.watermarkPresetId || presets[0]?.id || DEFAULT_PRESETS[0].id;
  });

  const activePreset = useMemo(() => {
    return presets.find((p) => p.id === selectedPresetId) || presets[0] || DEFAULT_PRESETS[0];
  }, [presets, selectedPresetId]);

  const currentConfig: WatermarkConfig = useMemo(() => {
    return box.watermarkConfig || activePreset.config || DEFAULT_WATERMARK_CONFIG;
  }, [box.watermarkConfig, activePreset]);

  const targetPages = box.targetPages || 'all';
  const customPages = box.customPages || '1, 2';

  // Apply preset selection
  const handleSelectPreset = (preset: WatermarkPreset) => {
    setSelectedPresetId(preset.id);
    const updatedName = `Watermark (${preset.name.split(' (')[0]})`;
    onUpdateBox(box.id, {
      title: box.title.startsWith('Watermark') ? updatedName : box.title,
      watermarkPresetId: preset.id,
      watermarkConfig: { ...preset.config, enabled: true },
      templateId: preset.id,
      templateText: preset.name,
    });
  };

  // Update specific config property
  const handleUpdateConfig = (updates: Partial<WatermarkConfig>) => {
    const updated = { ...currentConfig, ...updates, enabled: true };
    onUpdateBox(box.id, {
      watermarkConfig: updated,
    });
  };

  // Update page target scope
  const handleSelectTargetPages = (scope: 'all' | 'first-only' | 'body-only' | 'custom') => {
    onUpdateBox(box.id, { targetPages: scope });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 1. Saved Watermark Selection Cards */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.625rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FiShield style={{ color: '#F59E0B', fontSize: '15px' }} />
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Choose Saved Watermark
            </span>
          </div>
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
            {presets.length} saved presets available
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '0.625rem',
          }}
        >
          {presets.map((preset) => {
            const isSelected = selectedPresetId === preset.id;
            return (
              <div
                key={preset.id}
                onClick={() => handleSelectPreset(preset)}
                style={{
                  padding: '0.75rem',
                  borderRadius: '8px',
                  backgroundColor: isSelected
                    ? (isDark ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.08)')
                    : (isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)'),
                  border: isSelected
                    ? '1.5px solid #F59E0B'
                    : `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span
                    style={{
                      fontSize: '0.8125rem',
                      fontWeight: isSelected ? 700 : 600,
                      color: isSelected ? '#F59E0B' : 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '160px',
                    }}
                  >
                    {preset.name}
                  </span>
                  {isSelected && (
                    <span
                      style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        backgroundColor: '#F59E0B',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px',
                        flexShrink: 0,
                      }}
                    >
                      <FiCheck />
                    </span>
                  )}
                </div>

                {/* Preset Preview Box */}
                <div
                  style={{
                    height: '52px',
                    borderRadius: '5px',
                    backgroundColor: isDark ? '#0F172A' : '#1E293B',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px',
                    overflow: 'hidden',
                  }}
                >
                  {preset.config.type === 'logo' && preset.config.logoUrl ? (
                    <img
                      src={preset.config.logoUrl}
                      alt={preset.name}
                      style={{
                        maxHeight: '44px',
                        maxWidth: '90%',
                        objectFit: 'contain',
                        filter: preset.config.hasShadow ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' : undefined,
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        color: preset.config.textColor || '#FFFFFF',
                        textAlign: 'center',
                        lineHeight: 1.2,
                        padding: '2px 6px',
                      }}
                    >
                      {preset.config.text || 'Real Estate Watermark'}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                  <span>{POSITION_LABELS[preset.config.position] || preset.config.position}</span>
                  <span>{preset.config.opacity}% Opacity</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Target Page Assignment (Supports multiple pages & multiple watermarks) */}
      <div
        style={{
          padding: '0.875rem',
          borderRadius: '8px',
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
          border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.625rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FiLayers style={{ color: '#38BDF8', fontSize: '15px' }} />
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Page Assignment for Multiple Images
            </span>
          </div>
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
            Target specific photos in this post
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '6px' }}>
          {[
            { id: 'all', label: 'All Images', desc: 'Stamp every photo' },
            { id: 'first-only', label: 'Cover Only (Page 1)', desc: 'Main cover photo' },
            { id: 'body-only', label: 'Body (Pages 2+)', desc: 'Interior & details' },
            { id: 'custom', label: 'Custom Pages', desc: 'e.g. 1, 2, 4' },
          ].map((item) => {
            const isSelected = targetPages === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectTargetPages(item.id as any)}
                style={{
                  padding: '6px 8px',
                  borderRadius: '6px',
                  backgroundColor: isSelected
                    ? (isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(56, 189, 248, 0.1)')
                    : (isDark ? 'rgba(255, 255, 255, 0.04)' : '#FFFFFF'),
                  border: isSelected
                    ? '1.5px solid #0284C7'
                    : `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                  color: isSelected ? (isDark ? '#38BDF8' : '#0284C7') : 'var(--text-primary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ fontSize: '0.75rem', fontWeight: isSelected ? 700 : 600 }}>
                  {item.label}
                </span>
                <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                  {item.desc}
                </span>
              </button>
            );
          })}
        </div>

        {targetPages === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Specific Pages:</span>
            <input
              type="text"
              value={customPages}
              onChange={(e) => onUpdateBox(box.id, { customPages: e.target.value })}
              placeholder="e.g. 1, 2, 4"
              style={{
                fontSize: '0.75rem',
                padding: '4px 8px',
                borderRadius: '5px',
                backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)'}`,
                color: 'var(--text-primary)',
                width: '120px',
              }}
            />
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              (Comma-separated page numbers)
            </span>
          </div>
        )}

        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
          💡 <strong style={{ color: 'var(--text-primary)' }}>Multiple Watermarks:</strong> You can add multiple Watermark nodes in the workflow (for example: a bold Gold Shield on Page 1, and subtle contact info on Pages 2+).
        </div>
      </div>

      {/* 3. Live Canvas Preview & Position Controls */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem', alignItems: 'start' }}>
        {/* Real-time placement mock preview */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '6px' }}>
            <FiImage style={{ color: '#10B981', fontSize: '14px' }} />
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Live Real-Time Preview
            </span>
          </div>

          <div
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '16/10',
              borderRadius: '8px',
              overflow: 'hidden',
              backgroundColor: '#0F172A',
              border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}
          >
            <img
              src={SAMPLE_PREVIEW_PHOTO}
              alt="Property Preview"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />

            {/* Rendered Watermark on top of the preview photo */}
            {(() => {
              const pos = currentConfig.position || 'bottom-right';
              const scale = currentConfig.scale || 24;
              const opacity = (currentConfig.opacity || 85) / 100;
              const margin = (currentConfig.margin || 4);

              // Calculate flex / position placement
              const isTop = pos.startsWith('top');
              const isBottom = pos.startsWith('bottom');
              const isLeft = pos.endsWith('left');
              const isRight = pos.endsWith('right');

              return (
                <div
                  style={{
                    position: 'absolute',
                    top: isTop ? `${margin}%` : undefined,
                    bottom: isBottom ? `${margin}%` : undefined,
                    left: isLeft ? `${margin}%` : undefined,
                    right: isRight ? `${margin}%` : undefined,
                    ...(pos === 'center'
                      ? { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
                      : pos === 'top-center'
                      ? { top: `${margin}%`, left: '50%', transform: 'translateX(-50%)' }
                      : pos === 'bottom-center'
                      ? { bottom: `${margin}%`, left: '50%', transform: 'translateX(-50%)' }
                      : pos === 'center-left'
                      ? { top: '50%', left: `${margin}%`, transform: 'translateY(-50%)' }
                      : pos === 'center-right'
                      ? { top: '50%', right: `${margin}%`, transform: 'translateY(-50%)' }
                      : {}),
                    maxWidth: `${scale}%`,
                    opacity,
                    filter: currentConfig.hasShadow ? 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.55))' : undefined,
                    pointerEvents: 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {currentConfig.type === 'logo' && currentConfig.logoUrl ? (
                    <img
                      src={currentConfig.logoUrl}
                      alt="Watermark"
                      style={{ width: '100%', height: 'auto', display: 'block' }}
                    />
                  ) : (
                    <div
                      style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(0, 0, 0, 0.75)',
                        border: '1px solid rgba(255, 255, 255, 0.25)',
                        color: currentConfig.textColor || '#FFFFFF',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {currentConfig.text || 'Bangkok Estate'}
                    </div>
                  )}
                </div>
              );
            })()}

            <div
              style={{
                position: 'absolute',
                top: '6px',
                left: '8px',
                padding: '2px 6px',
                borderRadius: '4px',
                backgroundColor: 'rgba(0,0,0,0.65)',
                fontSize: '0.625rem',
                color: '#38BDF8',
                fontWeight: 600,
              }}
            >
              {targetPages === 'all'
                ? 'All Photos'
                : targetPages === 'first-only'
                ? 'Page 1 Only'
                : targetPages === 'body-only'
                ? 'Pages 2+ Only'
                : `Pages ${customPages}`}
            </div>
          </div>
        </div>

        {/* 9-grid position & fine-tuning */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Position
              </span>
              <span style={{ fontSize: '0.6875rem', color: '#F59E0B', fontWeight: 600 }}>
                {POSITION_LABELS[currentConfig.position] || currentConfig.position}
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '4px',
                width: '100%',
                maxWidth: '160px',
              }}
            >
              {NINE_POSITIONS.map((pos) => {
                const isActive = currentConfig.position === pos;
                return (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => handleUpdateConfig({ position: pos })}
                    style={{
                      height: '28px',
                      borderRadius: '4px',
                      backgroundColor: isActive
                        ? '#F59E0B'
                        : (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'),
                      border: isActive
                        ? '1px solid #F59E0B'
                        : `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease',
                    }}
                    title={POSITION_LABELS[pos]}
                  >
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: isActive
                          ? '#FFFFFF'
                          : (isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.3)'),
                      }}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scale Slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', marginBottom: '2px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Scale (Size)</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{currentConfig.scale || 24}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="45"
              value={currentConfig.scale || 24}
              onChange={(e) => handleUpdateConfig({ scale: parseInt(e.target.value, 10) })}
              style={{ width: '100%', accentColor: '#F59E0B' }}
            />
          </div>

          {/* Opacity Slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', marginBottom: '2px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Opacity</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{currentConfig.opacity || 85}%</span>
            </div>
            <input
              type="range"
              min="15"
              max="100"
              value={currentConfig.opacity || 85}
              onChange={(e) => handleUpdateConfig({ opacity: parseInt(e.target.value, 10) })}
              style={{ width: '100%', accentColor: '#F59E0B' }}
            />
          </div>
        </div>
      </div>

      {/* Footer buttons */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: '0.75rem',
          borderTop: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
        }}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            onDeleteBox(box.id);
            onClose();
          }}
          leftIcon={<FiTrash2 style={{ color: '#EF4444' }} />}
          style={{ borderColor: 'rgba(239, 68, 68, 0.3)', color: '#EF4444' }}
        >
          Delete Watermark Node
        </Button>

        <Button
          variant="primary"
          size="sm"
          onClick={onClose}
          leftIcon={<FiCheck />}
          style={{ backgroundColor: '#F59E0B', borderColor: '#F59E0B' }}
        >
          Save & Done
        </Button>
      </div>
    </div>
  );
};
