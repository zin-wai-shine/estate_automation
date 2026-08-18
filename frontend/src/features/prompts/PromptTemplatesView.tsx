import React, { useState } from 'react';
import type { PromptTemplate } from '../../types';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { CustomDropdown } from '../../components/ui/CustomDropdown';
import type { DropdownOption } from '../../components/ui/CustomDropdown';
import {
  FiFileText,
  FiPlus,
  FiPower,
  FiCheckCircle,
  FiEye,
  FiSearch,
} from 'react-icons/fi';

export const PromptTemplatesView: React.FC = () => {
  const [prompts, setPrompts] = useState<PromptTemplate[]>([
    {
      id: 1,
      name: 'Facebook Rental Listing Copy (Thai/English)',
      category: 'FACEBOOK_RENT',
      version: 'V1.2',
      active: true,
      templateText:
        'Generate an attractive Facebook real estate rental post for a condo in Bangkok.\nTitle: {title}\nPrice: {price}\nLocation: {location}\nInclude high-converting CTA and relevant hashtags.',
    },
    {
      id: 2,
      name: 'TikTok Short Video Script & Hook Generator',
      category: 'TIKTOK',
      version: 'V1.0',
      active: true,
      templateText:
        'Create a viral 15-second TikTok video script for property listing {title}.\nStart with a high-curiosity hook, list 3 key highlights, and end with Line ID CTA.',
    },
    {
      id: 3,
      name: 'Facebook Property Sale Copy Template',
      category: 'FACEBOOK_SALE',
      version: 'V1.0',
      active: true,
      templateText:
        'Write a professional sales copy for property sale: {title}.\nHighlight investment yield, BTS access, and price {price}.',
    },
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Detail / Edit modal state
  const [activePrompt, setActivePrompt] = useState<PromptTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newTemplate, setNewTemplate] = useState<{
    name: string;
    category: PromptTemplate['category'];
    templateText: string;
  }>({
    name: '',
    category: 'FACEBOOK_SALE',
    templateText: '',
  });

  const toggleActive = (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPrompts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, active: !p.active } : p))
    );
  };

  const handleCreateNew = () => {
    if (!newTemplate.name.trim() || !newTemplate.templateText.trim()) return;
    const created: PromptTemplate = {
      id: Date.now(),
      name: newTemplate.name,
      category: newTemplate.category,
      version: 'V1.0',
      active: true,
      templateText: newTemplate.templateText,
    };
    setPrompts((prev) => [created, ...prev]);
    setIsCreating(false);
    setNewTemplate({ name: '', category: 'FACEBOOK_SALE', templateText: '' });
  };

  const formatCategoryLabel = (category: string) => {
    switch (category) {
      case 'FACEBOOK_SALE':
        return 'Facebook Sale';
      case 'FACEBOOK_RENT':
        return 'Facebook Rent';
      case 'TIKTOK':
        return 'TikTok';
      case 'EN_TRANSLATION':
        return 'English Translation';
      case 'IMAGE_ENHANCE':
        return 'Image Enhance';
      default:
        return category;
    }
  };

  const getCategoryBadgeVariant = (category: string): 'info' | 'warning' | 'default' => {
    if (category.includes('FACEBOOK')) return 'info';
    if (category.includes('TIKTOK')) return 'warning';
    return 'default';
  };

  const categoryOptions: DropdownOption[] = [
    { value: 'ALL', label: 'All Categories' },
    { value: 'FACEBOOK_SALE', label: 'Facebook Sale' },
    { value: 'FACEBOOK_RENT', label: 'Facebook Rent' },
    { value: 'TIKTOK', label: 'TikTok' },
    { value: 'EN_TRANSLATION', label: 'English Translation' },
    { value: 'IMAGE_ENHANCE', label: 'Image Enhance' },
  ];

  const categoryFormOptions: DropdownOption[] = [
    { value: 'FACEBOOK_SALE', label: 'Facebook Sale' },
    { value: 'FACEBOOK_RENT', label: 'Facebook Rent' },
    { value: 'TIKTOK', label: 'TikTok' },
    { value: 'EN_TRANSLATION', label: 'English Translation' },
    { value: 'IMAGE_ENHANCE', label: 'Image Enhance' },
  ];

  const filteredPrompts = prompts.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.templateText.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'ALL' || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '1280px', margin: '0 auto', boxSizing: 'border-box' }}>
      {/* Clean Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: '0.375rem', backgroundColor: 'var(--accent-primary-alpha)', color: 'var(--accent-primary)' }}>
              AI Generation Engine
            </span>
          </div>
          <h2 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>
            Prompt Templates
          </h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem', margin: '0.25rem 0 0 0' }}>
            Manage structured AI copy prompts and dynamic variables for Facebook listings, TikTok scripts, and marketing copy.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          leftIcon={<FiPlus />}
          onClick={() => setIsCreating(true)}
          style={{ height: '38px', padding: '0 1.125rem', fontSize: '0.8125rem' }}
        >
          Create Template
        </Button>
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flex: 1, minWidth: '280px' }}>
          {/* Search Bar */}
          <div style={{ position: 'relative', width: '100%', maxWidth: '340px' }}>
            <FiSearch style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.9375rem' }} />
            <input
              type="text"
              placeholder="Search templates or variables..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.875rem 0.5rem 2.375rem',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '0.5rem',
                outline: 'none',
                fontSize: '0.8125rem',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Clean Custom React Dropdown */}
          <div style={{ width: '200px' }}>
            <CustomDropdown
              options={categoryOptions}
              value={categoryFilter}
              onChange={(val) => setCategoryFilter(val)}
            />
          </div>
        </div>

        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
          Showing {filteredPrompts.length} of {prompts.length} Templates
        </span>
      </div>

      {/* Modern React Table Container */}
      <div
        style={{
          width: '100%',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: '0.875rem',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderBottom: '1px solid var(--border-color)',
              }}
            >
              <th style={{ padding: '0.875rem 1.25rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', width: '48%', whiteSpace: 'nowrap' }}>
                Template Name & Preview
              </th>
              <th style={{ padding: '0.875rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', width: '18%', whiteSpace: 'nowrap' }}>
                Category
              </th>
              <th style={{ padding: '0.875rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', width: '10%', whiteSpace: 'nowrap' }}>
                Version
              </th>
              <th style={{ padding: '0.875rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', width: '10%', whiteSpace: 'nowrap' }}>
                Status
              </th>
              <th style={{ padding: '0.875rem 1.25rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right', width: '14%', whiteSpace: 'nowrap' }}>
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {filteredPrompts.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  No prompt templates found matching your search.
                </td>
              </tr>
            ) : (
              filteredPrompts.map((prompt) => (
                <tr
                  key={prompt.id}
                  onClick={() => setActivePrompt(prompt)}
                  style={{
                    borderBottom: '1px solid var(--border-color)',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  {/* Template Name & Preview */}
                  <td style={{ padding: '1rem 1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '0.5rem',
                          backgroundColor: 'var(--accent-primary-alpha)',
                          color: 'var(--accent-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.125rem',
                          flexShrink: 0,
                        }}
                      >
                        <FiFileText />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                          {prompt.name}
                        </div>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '520px',
                            fontFamily: 'monospace',
                          }}
                        >
                          {prompt.templateText.replace(/\n/g, ' ')}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Category */}
                  <td style={{ padding: '1rem', whiteSpace: 'nowrap' }}>
                    <Badge variant={getCategoryBadgeVariant(prompt.category)} size="sm">
                      {formatCategoryLabel(prompt.category)}
                    </Badge>
                  </td>

                  {/* Version */}
                  <td style={{ padding: '1rem', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                      {prompt.version}
                    </span>
                  </td>

                  {/* Status */}
                  <td style={{ padding: '1rem', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                      <span
                        style={{
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          backgroundColor: prompt.active ? 'var(--status-success)' : 'var(--text-muted)',
                          display: 'inline-block',
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ color: prompt.active ? 'var(--status-success)' : 'var(--text-muted)', fontWeight: 500 }}>
                        {prompt.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '1rem 1.25rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="outline"
                        size="sm"
                        leftIcon={<FiPower />}
                        onClick={(e) => toggleActive(prompt.id, e)}
                        style={{ height: '32px', fontSize: '0.75rem', padding: '0 0.625rem', whiteSpace: 'nowrap' }}
                      >
                        {prompt.active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        leftIcon={<FiEye />}
                        onClick={() => setActivePrompt(prompt)}
                        style={{ height: '32px', fontSize: '0.75rem', padding: '0 0.75rem', whiteSpace: 'nowrap' }}
                      >
                        Detail & Edit
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Prompt Detail & Editor Modal */}
      {activePrompt && (
        <Modal isOpen={!!activePrompt} onClose={() => setActivePrompt(null)} title={`Prompt Template Detail: ${activePrompt.name}`} maxWidth="600px">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Header info pills */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1rem', borderRadius: '0.625rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Badge variant={getCategoryBadgeVariant(activePrompt.category)} size="sm">
                  {formatCategoryLabel(activePrompt.category)}
                </Badge>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>{activePrompt.version}</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 500, color: activePrompt.active ? 'var(--status-success)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: activePrompt.active ? 'var(--status-success)' : 'var(--text-muted)' }} />
                  {activePrompt.active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.375rem' }}>
                Template Name
              </label>
              <Input
                value={activePrompt.name}
                onChange={(e) => setActivePrompt({ ...activePrompt, name: e.target.value })}
              />
            </div>

            <div>
              <CustomDropdown
                label="Category"
                options={categoryFormOptions}
                value={activePrompt.category}
                onChange={(val) => setActivePrompt({ ...activePrompt, category: val as PromptTemplate['category'] })}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.375rem' }}>
                Prompt Structure & Dynamic Variables ({'{title}'}, {'{price}'}, {'{location}'})
              </label>
              <textarea
                rows={7}
                value={activePrompt.templateText}
                onChange={(e) => setActivePrompt({ ...activePrompt, templateText: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '0.5rem',
                  outline: 'none',
                  fontSize: '0.8125rem',
                  fontFamily: 'monospace',
                  lineHeight: 1.5,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<FiPower />}
                onClick={() => {
                  const updated = { ...activePrompt, active: !activePrompt.active };
                  setActivePrompt(updated);
                  setPrompts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
                }}
              >
                {activePrompt.active ? 'Deactivate Prompt' : 'Activate Prompt'}
              </Button>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button variant="outline" size="sm" onClick={() => setActivePrompt(null)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<FiCheckCircle />}
                  onClick={() => {
                    setPrompts((prev) => prev.map((p) => (p.id === activePrompt.id ? activePrompt : p)));
                    setActivePrompt(null);
                  }}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Create New Prompt Modal */}
      {isCreating && (
        <Modal isOpen={isCreating} onClose={() => setIsCreating(false)} title="Create Prompt Template" maxWidth="560px">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.375rem' }}>
                Template Name
              </label>
              <Input
                placeholder="e.g. Facebook High-Yield Property Sale Copy"
                value={newTemplate.name}
                onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
              />
            </div>

            <div>
              <CustomDropdown
                label="Category"
                options={categoryFormOptions}
                value={newTemplate.category}
                onChange={(val) => setNewTemplate({ ...newTemplate, category: val as PromptTemplate['category'] })}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.375rem' }}>
                Prompt Structure & Variables ({'{title}'}, {'{price}'}, {'{location}'})
              </label>
              <textarea
                rows={5}
                placeholder="Write structured prompt instructions..."
                value={newTemplate.templateText}
                onChange={(e) => setNewTemplate({ ...newTemplate, templateText: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '0.5rem',
                  outline: 'none',
                  fontSize: '0.8125rem',
                  fontFamily: 'monospace',
                  lineHeight: 1.5,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <Button variant="outline" size="sm" onClick={() => setIsCreating(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<FiCheckCircle />}
                onClick={handleCreateNew}
              >
                Create Template
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
