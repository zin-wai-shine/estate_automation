import React, { useState, useMemo } from 'react';
import { FiCheck, FiEdit2 } from 'react-icons/fi';
import {
  type CropStudioFormat,
  getSavedCropFormats,
} from '../watermark/cropFormats';
import type { DynamicAIBoxConfig } from './FacebookWorkflowCanvas';

interface WatermarkNodeModalProps {
  box: DynamicAIBoxConfig;
  isDark: boolean;
  onUpdateBox: (id: string, updates: Partial<DynamicAIBoxConfig>) => void;
  onDeleteBox?: (id: string) => void;
  onClose?: () => void;
}

export const WatermarkNodeModal: React.FC<WatermarkNodeModalProps> = ({
  box,
  isDark,
  onUpdateBox,
}) => {
  const savedFormats = useMemo(() => getSavedCropFormats(), []);

  const [selectedFormatId, setSelectedFormatId] = useState<string>(() => {
    return (
      box.cropFormatId ||
      savedFormats.find((f) => f.id === box.templateId)?.id ||
      savedFormats.find((f) => f.isDefault)?.id ||
      savedFormats[0]?.id ||
      'format-ig-portrait'
    );
  });

  const [nodeTitle, setNodeTitle] = useState<string>(box.title || 'Photo Format');

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
    });
  };

  const handleTitleChange = (val: string) => {
    setNodeTitle(val);
    onUpdateBox(box.id, { title: val });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Intro info bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
          Select a format to automatically crop & frame photos:
        </span>
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

      {/* Preset Format Cards (Single-column clean list) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          maxHeight: '340px',
          overflowY: 'auto',
          paddingRight: '2px',
        }}
      >
        {savedFormats.map((format) => {
          const isSelected = selectedFormatId === format.id;
          return (
            <div
              key={format.id}
              onClick={() => handleSelectFormat(format)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: '8px',
                border: `1.5px solid ${isSelected ? 'var(--accent-primary, #3B82F6)' : 'var(--border-color)'}`,
                backgroundColor: isSelected
                  ? (isDark ? 'rgba(59, 130, 246, 0.12)' : 'rgba(59, 130, 246, 0.05)')
                  : (isDark ? 'rgba(255, 255, 255, 0.02)' : 'var(--bg-main)'),
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                gap: '12px',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = 'var(--accent-primary, #3B82F6)';
                  e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.04)' : 'var(--bg-surface)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.02)' : 'var(--bg-main)';
                }
              }}
            >
              {/* Left Aspect Badge & Text */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                <span
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '5px',
                    backgroundColor: isSelected
                      ? 'var(--accent-primary, #3B82F6)'
                      : (isDark ? 'rgba(255, 255, 255, 0.08)' : '#FFFFFF'),
                    border: isSelected
                      ? 'none'
                      : '1px solid var(--border-color)',
                    color: isSelected ? '#FFFFFF' : 'var(--text-primary)',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    flexShrink: 0,
                    minWidth: '38px',
                    textAlign: 'center',
                  }}
                >
                  {format.aspect || '1:1'}
                </span>

                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        color: isSelected ? 'var(--accent-primary, #3B82F6)' : 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {format.name}
                    </span>
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        color: 'var(--text-muted)',
                        fontWeight: 500,
                      }}
                    >
                      {format.targetWidth} × {format.targetHeight} px
                    </span>
                  </div>

                  {format.description && (
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        color: 'var(--text-muted)',
                        marginTop: '1px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {format.description.split('•')[1]?.trim() || format.description}
                    </span>
                  )}
                </div>
              </div>

              {/* Right Radio Indicator */}
              <div
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isSelected ? 'var(--accent-primary, #3B82F6)' : 'transparent',
                  border: isSelected ? 'none' : `1.5px solid ${isDark ? 'rgba(255, 255, 255, 0.25)' : '#CBD5E1'}`,
                  color: '#FFFFFF',
                  fontSize: '11px',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                }}
              >
                {isSelected && <FiCheck strokeWidth={2.5} />}
              </div>
            </div>
          );
        })}
      </div>

      {/* Node Name input (compact & subtle) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 10px',
          borderRadius: '6px',
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'var(--bg-main)',
          border: '1px solid var(--border-color)',
        }}
      >
        <FiEdit2 size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
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


    </div>
  );
};
