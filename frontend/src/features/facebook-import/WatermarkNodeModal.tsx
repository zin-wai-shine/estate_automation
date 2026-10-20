import React, { useState, useMemo } from 'react';
import { FiEdit2 } from 'react-icons/fi';
import {
  type CropStudioFormat,
  getSavedCropFormats,
} from '../watermark/cropFormats';
import type { DynamicAIBoxConfig } from './FacebookWorkflowCanvas';
import { Select, type SelectOption } from '../../components/ui/Select';

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

  const formatOptions = useMemo<SelectOption[]>(() => {
    return savedFormats.map((f) => ({
      value: f.id,
      label: `${f.name} (${f.targetWidth}×${f.targetHeight} · ${f.aspect || '1:1'})`,
    }));
  }, [savedFormats]);

  const currentFormat = useMemo(() => {
    return savedFormats.find((f) => f.id === selectedFormatId) || savedFormats[0];
  }, [savedFormats, selectedFormatId]);

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
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {currentFormat.name}
              </span>
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
    </div>
  );
};
