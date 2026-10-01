import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Select';
import {
  FacebookWorkflowCanvas,
  DEFAULT_FB_WORKFLOW_CONFIG,
  type FacebookWorkflowConfig,
} from '../facebook-import/FacebookWorkflowCanvas';
import {
  getSavedWorkflowFormats,
  saveWorkflowFormatsList,
  getActiveWorkflowFormatId,
  setActiveWorkflowFormatId,
  type WorkflowFormat,
} from './workflowFormats';
import {
  FiGitBranch,
  FiPlus,
  FiSave,
  FiCopy,
  FiTrash2,
  FiCheck,
  FiArrowRight,
  FiLayers,
  FiCheckCircle,
} from 'react-icons/fi';

export const CreateWorkflowView: React.FC = () => {
  const navigate = useNavigate();
  const [formats, setFormats] = useState<WorkflowFormat[]>(() => getSavedWorkflowFormats());
  const [selectedFormatId, setSelectedFormatId] = useState<string>(() => getActiveWorkflowFormatId());
  const [currentFormat, setCurrentFormat] = useState<WorkflowFormat>(() => {
    const list = getSavedWorkflowFormats();
    const id = getActiveWorkflowFormatId();
    return list.find((f) => f.id === id) || list[0];
  });

  const [formatName, setFormatName] = useState<string>(currentFormat.name);
  const [formatDescription, setFormatDescription] = useState<string>(currentFormat.description || '');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync state when format selection changes
  const handleSelectFormat = (formatId: string) => {
    setSelectedFormatId(formatId);
    setActiveWorkflowFormatId(formatId);
    const found = formats.find((f) => f.id === formatId);
    if (found) {
      setCurrentFormat(found);
      setFormatName(found.name);
      setFormatDescription(found.description || '');
    }
  };

  // Create New Format
  const handleCreateNewFormat = () => {
    const newId = `format-${Date.now()}`;
    const newFormat: WorkflowFormat = {
      id: newId,
      name: `Custom Workflow #${formats.length + 1}`,
      description: 'Customized Facebook import extraction and dynamic AI generation pipeline',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      config: {
        ...DEFAULT_FB_WORKFLOW_CONFIG,
        aiBoxes: [
          {
            id: `ai-box-${Date.now()}`,
            title: 'Dynamic AI Copywriter',
            processType: 'rental',
            provider: 'google_ai',
            model: 'gemini-flash-latest',
            templateId: '1',
            templateText:
              'Generate an attractive Facebook real estate listing post from the extracted caption.',
            customPrompt: '',
            enabled: true,
            x: 680,
            y: 120,
          },
        ],
      },
    };

    const updatedList = [...formats, newFormat];
    setFormats(updatedList);
    saveWorkflowFormatsList(updatedList);
    setSelectedFormatId(newId);
    setActiveWorkflowFormatId(newId);
    setCurrentFormat(newFormat);
    setFormatName(newFormat.name);
    setFormatDescription(newFormat.description);
  };

  // Duplicate Current Format
  const handleDuplicateFormat = () => {
    const newId = `format-${Date.now()}`;
    const duplicated: WorkflowFormat = {
      ...currentFormat,
      id: newId,
      name: `${currentFormat.name} (Copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      config: JSON.parse(JSON.stringify(currentFormat.config)),
    };

    const updatedList = [...formats, duplicated];
    setFormats(updatedList);
    saveWorkflowFormatsList(updatedList);
    setSelectedFormatId(newId);
    setActiveWorkflowFormatId(newId);
    setCurrentFormat(duplicated);
    setFormatName(duplicated.name);
  };

  // Save Format
  const handleSaveFormat = () => {
    const updated: WorkflowFormat = {
      ...currentFormat,
      name: formatName.trim() || 'Untitled Workflow Format',
      description: formatDescription.trim(),
      updatedAt: Date.now(),
    };

    const updatedList = formats.map((f) => (f.id === currentFormat.id ? updated : f));
    setFormats(updatedList);
    setCurrentFormat(updated);
    saveWorkflowFormatsList(updatedList);

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  // Delete Format
  const handleDeleteFormat = () => {
    if (formats.length <= 1) {
      alert('You must keep at least one workflow format.');
      return;
    }
    if (!window.confirm(`Delete workflow format "${currentFormat.name}"?`)) {
      return;
    }

    const updatedList = formats.filter((f) => f.id !== currentFormat.id);
    setFormats(updatedList);
    saveWorkflowFormatsList(updatedList);

    const nextFormat = updatedList[0];
    setSelectedFormatId(nextFormat.id);
    setActiveWorkflowFormatId(nextFormat.id);
    setCurrentFormat(nextFormat);
    setFormatName(nextFormat.name);
    setFormatDescription(nextFormat.description || '');
  };

  // Update canvas config inside current format
  const handleCanvasConfigChange = (newConfig: FacebookWorkflowConfig) => {
    const updated: WorkflowFormat = {
      ...currentFormat,
      config: newConfig,
      updatedAt: Date.now(),
    };
    setCurrentFormat(updated);
    const updatedList = formats.map((f) => (f.id === currentFormat.id ? updated : f));
    setFormats(updatedList);
    saveWorkflowFormatsList(updatedList);
  };

  // Switch to Facebook Import using this format
  const handleUseInFacebookImport = () => {
    setActiveWorkflowFormatId(currentFormat.id);
    navigate('/facebook-import');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '3rem' }}>
      {/* Top Header Card */}
      <div
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '0.75rem',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '0.625rem',
                backgroundColor: 'rgba(139, 92, 246, 0.15)',
                color: '#A78BFA',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.35rem',
                flexShrink: 0,
              }}
            >
              <FiGitBranch />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Create & Setup Workflow
                </h2>
                <Badge variant="info">Format Builder</Badge>
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
                Build reusable workflow formats with custom branches (Get Content, Get Images) and stacked dynamic AI prompt boxes.
              </p>
            </div>
          </div>

          {/* Quick Action: Apply to Facebook Import */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCreateNewFormat}
              leftIcon={<FiPlus style={{ color: '#10B981' }} />}
              style={{ height: '36px', fontSize: '0.8125rem', borderColor: 'rgba(16, 185, 129, 0.4)', color: '#10B981' }}
            >
              New Format
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleDuplicateFormat}
              leftIcon={<FiCopy />}
              style={{ height: '36px', fontSize: '0.8125rem' }}
            >
              Duplicate
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteFormat}
              leftIcon={<FiTrash2 style={{ color: '#EF4444' }} />}
              style={{ height: '36px', fontSize: '0.8125rem', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#EF4444' }}
            >
              Delete
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveFormat}
              leftIcon={saveSuccess ? <FiCheck /> : <FiSave />}
              style={{
                height: '36px',
                fontSize: '0.8125rem',
                backgroundColor: saveSuccess ? 'var(--status-success)' : undefined,
              }}
            >
              {saveSuccess ? 'Saved Format!' : 'Save Format'}
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handleUseInFacebookImport}
              leftIcon={<FiArrowRight />}
              style={{
                height: '36px',
                fontSize: '0.8125rem',
                background: 'linear-gradient(135deg, #1877F2 0%, #3B82F6 100%)',
              }}
            >
              Use in Facebook Import
            </Button>
          </div>
        </div>

        {/* Format Selector & Title Editor Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            flexWrap: 'wrap',
            paddingTop: '0.75rem',
            borderTop: '1px solid var(--border-color)',
          }}
        >
          {/* Preset Selector */}
          <div style={{ flex: '1 1 280px', minWidth: '240px' }}>
            <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
              Select Workflow Format
            </label>
            <Select
              options={formats.map((f) => ({
                value: f.id,
                label: `${f.name} (${f.config.aiBoxes.length} AI Box${f.config.aiBoxes.length > 1 ? 'es' : ''})`,
              }))}
              value={selectedFormatId}
              onChange={handleSelectFormat}
              height="36px"
            />
          </div>

          {/* Format Name Input */}
          <div style={{ flex: '2 1 320px', minWidth: '260px' }}>
            <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
              Format Name
            </label>
            <input
              type="text"
              value={formatName}
              onChange={(e) => setFormatName(e.target.value)}
              placeholder="e.g. Standard Bangkok Condo Rental Flow..."
              style={{
                width: '100%',
                height: '36px',
                padding: '0 0.75rem',
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                borderRadius: '0.5rem',
                color: 'var(--text-primary)',
                fontSize: '0.8125rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Quick Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.25rem' }}>
            <Badge variant={currentFormat.config.getContent.enabled ? 'info' : 'default'} size="sm">
              Content: {currentFormat.config.getContent.enabled ? 'ON' : 'OFF'}
            </Badge>
            <Badge variant={currentFormat.config.getImages.enabled ? 'success' : 'default'} size="sm">
              Images: {currentFormat.config.getImages.enabled ? 'ON' : 'OFF'}
            </Badge>
            <Badge variant="warning" size="sm">
              {currentFormat.config.aiBoxes.length} AI Boxes
            </Badge>
          </div>
        </div>
      </div>

      {/* Visual Canvas Editor (Bound to the current format's config) */}
      <div key={currentFormat.id}>
        <FacebookWorkflowCanvas
          initialConfig={currentFormat.config}
          onConfigChange={handleCanvasConfigChange}
        />
      </div>
    </div>
  );
};
