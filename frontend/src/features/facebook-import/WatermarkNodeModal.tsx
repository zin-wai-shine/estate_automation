import React, { useState, useMemo } from 'react';
import {
  FiScissors,
  FiCheck,
  FiTrash2,
  FiExternalLink,
} from 'react-icons/fi';
import {
  type CropStudioFormat,
  getSavedCropFormats,
} from '../watermark/cropFormats';
import type { DynamicAIBoxConfig } from './FacebookWorkflowCanvas';
import { Button } from '../../components/ui/Button';
import { useNavigate } from 'react-router-dom';

interface WatermarkNodeModalProps {
  box: DynamicAIBoxConfig;
  isDark: boolean;
  onUpdateBox: (id: string, updates: Partial<DynamicAIBoxConfig>) => void;
  onDeleteBox: (id: string) => void;
  onClose: () => void;
}

export const WatermarkNodeModal: React.FC<WatermarkNodeModalProps> = ({
  box,
  isDark,
  onUpdateBox,
  onDeleteBox,
  onClose,
}) => {
  const navigate = useNavigate();
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

  const handleSelectFormat = (format: CropStudioFormat) => {
    setSelectedFormatId(format.id);
    onUpdateBox(box.id, {
      title: `Format: ${format.name}`,
      subtitle: `${format.targetWidth}×${format.targetHeight} (${format.aspect || 'Crop'})`,
      cropFormatId: format.id,
      templateId: format.id,
      templateText: format.name,
      watermarkPresetId: format.id,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header Info */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: isDark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FiScissors style={{ color: '#8B5CF6', fontSize: '16px' }} />
          </div>
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Choose Saved Studio Format
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Select a format saved in Crop & Cut Studio to automatically format imported photos
            </div>
          </div>
        </div>
        <span
          style={{
            fontSize: '0.6875rem',
            padding: '2px 8px',
            borderRadius: '12px',
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
            color: 'var(--text-secondary)',
            fontWeight: 500,
          }}
        >
          {savedFormats.length} formats available
        </span>
      </div>

      {/* Grid of Saved Formats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '0.75rem',
          maxHeight: '380px',
          overflowY: 'auto',
          padding: '2px',
        }}
      >
        {savedFormats.map((format) => {
          const isSelected = selectedFormatId === format.id;
          return (
            <div
              key={format.id}
              onClick={() => handleSelectFormat(format)}
              style={{
                padding: '0.875rem 1rem',
                borderRadius: '10px',
                backgroundColor: isSelected
                  ? (isDark ? 'rgba(139, 92, 246, 0.12)' : 'rgba(139, 92, 246, 0.08)')
                  : (isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)'),
                border: isSelected
                  ? '1.5px solid #8B5CF6'
                  : `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                position: 'relative',
              }}
            >
              {/* Top row: Format Name & Check Badge */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: isSelected ? 700 : 600,
                    color: isSelected ? '#8B5CF6' : 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {format.name}
                </span>
                {isSelected ? (
                  <span
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      backgroundColor: '#8B5CF6',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      flexShrink: 0,
                    }}
                  >
                    <FiCheck />
                  </span>
                ) : (
                  <span
                    style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      border: `1.5px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'}`,
                      flexShrink: 0,
                    }}
                  />
                )}
              </div>

              {/* Dimensions and Aspect Pill */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: '4px',
                    backgroundColor: isSelected
                      ? '#8B5CF6'
                      : (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'),
                    color: isSelected ? '#FFFFFF' : 'var(--text-secondary)',
                  }}
                >
                  {format.aspect || 'Custom'}
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  {format.targetWidth} × {format.targetHeight} px
                </span>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                  • {format.mode === 'grid' ? 'Grid Split' : 'Cover'}
                </span>
              </div>

              {/* Description */}
              {format.description && (
                <div
                  style={{
                    fontSize: '0.6875rem',
                    color: 'var(--text-muted)',
                    lineHeight: 1.35,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {format.description}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Controls: Delete, Manage in Studio, Done */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '0.75rem',
          borderTop: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => onDeleteBox(box.id)}
          leftIcon={<FiTrash2 style={{ fontSize: '13px' }} />}
          style={{
            color: '#EF4444',
            borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.4)',
            fontSize: '0.75rem',
            height: '32px',
          }}
        >
          Delete Node
        </Button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onClose();
              navigate('/watermark');
            }}
            leftIcon={<FiExternalLink style={{ fontSize: '13px' }} />}
            style={{
              fontSize: '0.75rem',
              height: '32px',
            }}
            title="Open Crop & Cut Studio to edit or save new formats"
          >
            Open Crop & Cut Studio
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={onClose}
            leftIcon={<FiCheck style={{ fontSize: '13px' }} />}
            style={{
              backgroundColor: '#8B5CF6',
              borderColor: '#8B5CF6',
              fontSize: '0.75rem',
              height: '32px',
              fontWeight: 600,
            }}
          >
            Apply Format
          </Button>
        </div>
      </div>
    </div>
  );
};
