import React, { useState, useEffect } from 'react';
import type { Property } from '../../types';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import {
  FiPlus,
  FiExternalLink,
  FiCheck,
  FiEye,
  FiCopy,
  FiTrash2,
  FiZap,
  FiCheckCircle,
  FiCalendar,
  FiLink,
} from 'react-icons/fi';
import {
  fetchUrlGroups,
  createUrlGroup,
  deleteUrlGroup,
  clearAllUrlGroups,
  type UrlGroupItem,
} from '../../services/urlGroupService';

interface AddUrlViewProps {
  properties?: Property[];
  onAddProperty?: (url: string, extractedData?: Partial<Property>) => void;
  onProcessBatch?: (ids: number[]) => void;
}

export const formatOrParseUrls = (text: string): string[] => {
  if (!text) return [];
  const separated = text.replace(/([^\s])(https?:\/\/)/gi, '$1\n$2');
  const matches = separated.match(/https?:\/\/[^\s,;]+/gi);
  if (!matches) {
    return separated
      .split(/[\n\r,;]+/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }
  return matches.map((u) => u.trim()).filter((u) => u.length > 0);
};

export const AddUrlView: React.FC<AddUrlViewProps> = () => {
  const [urlGroups, setUrlGroups] = useState<UrlGroupItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [rawUrlsText, setRawUrlsText] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState('');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [viewingGroup, setViewingGroup] = useState<UrlGroupItem | null>(null);
  const [viewModalCopied, setViewModalCopied] = useState(false);

  // Load URL groups from the backend database table on mount
  const loadGroups = async () => {
    setIsLoading(true);
    try {
      const data = await fetchUrlGroups();
      setUrlGroups(data);
    } catch (err) {
      console.error('Failed to load URL groups:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  const sampleTestUrls = [
    'https://www.facebook.com/groups/bangkokcondos/posts/10892419401',
    'https://www.facebook.com/marketplace/item/92841028401',
    'https://www.facebook.com/groups/phromphongrentals/posts/8910243',
  ];

  const insertSampleTestUrls = () => {
    setRawUrlsText(sampleTestUrls.join('\n'));
  };

  const getValidUrls = (): string[] => {
    return formatOrParseUrls(rawUrlsText);
  };

  const handleTextareaChange = (val: string) => {
    if (/(https?:\/\/[^\s]+)(https?:\/\/)/i.test(val)) {
      const autoSplit = val.replace(/([^\s])(https?:\/\/)/gi, '$1\n$2');
      setRawUrlsText(autoSplit);
    } else {
      setRawUrlsText(val);
    }
  };

  const validUrls = getValidUrls();

  // Save multiple or single link together as ONE single row
  const handleSaveUrlGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const textToSave = rawUrlsText.trim();
    if (!textToSave) return;

    setIsSaving(true);
    try {
      const newGroup = await createUrlGroup(textToSave);
      setUrlGroups((prev) => [...prev, newGroup]);
      setIsModalOpen(false);
      setRawUrlsText('');

      const count = newGroup.url_count || validUrls.length || 1;
      setNotification(`Saved group #${newGroup.serial} with ${count} link${count === 1 ? '' : 's'} successfully!`);
      setTimeout(() => setNotification(''), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to save URL group');
    } finally {
      setIsSaving(false);
    }
  };

  // Copy all links in the group text to clipboard
  const handleCopyLinks = async (group: UrlGroupItem) => {
    try {
      await navigator.clipboard.writeText(group.raw_text);
      setCopiedId(group.id);
      setTimeout(() => setCopiedId(null), 2000);

      const count = group.url_count || 1;
      setNotification(`Copied all ${count} link${count === 1 ? '' : 's'} from Serial #${group.serial} to clipboard!`);
      setTimeout(() => setNotification(''), 3500);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  // Copy links from inside the View modal
  const handleCopyFromModal = async (group: UrlGroupItem) => {
    try {
      await navigator.clipboard.writeText(group.raw_text);
      setViewModalCopied(true);
      setTimeout(() => setViewModalCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Delete a specific row
  const handleDeleteGroup = async (id: number) => {
    if (!window.confirm('Delete this saved link group?')) return;
    try {
      await deleteUrlGroup(id);
      setUrlGroups((prev) => prev.filter((g) => g.id !== id));
      if (viewingGroup?.id === id) setViewingGroup(null);
      setNotification('Link group deleted.');
      setTimeout(() => setNotification(''), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    }
  };

  // Bulk clear all groups
  const handleClearAll = async () => {
    if (urlGroups.length === 0) return;
    if (!window.confirm('Are you sure you want to delete all saved link groups?')) return;
    try {
      await clearAllUrlGroups();
      setUrlGroups([]);
      setNotification('All URL groups cleared.');
      setTimeout(() => setNotification(''), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to clear');
    }
  };

  // Format date helper
  const formatDate = (dateStr?: string): { formatted: string; relative: string } => {
    if (!dateStr) return { formatted: '-', relative: '' };
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return { formatted: dateStr, relative: '' };

    const formatted = date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    let relative = 'Just now';
    if (diffMins >= 60 * 24) {
      const days = Math.floor(diffMins / (60 * 24));
      relative = `${days}d ago`;
    } else if (diffMins >= 60) {
      const hrs = Math.floor(diffMins / 60);
      relative = `${hrs}h ago`;
    } else if (diffMins >= 1) {
      relative = `${diffMins}m ago`;
    }

    return { formatted, relative };
  };

  // Parse links array from urls_json or raw_text
  const getGroupUrlsList = (group: UrlGroupItem): string[] => {
    if (group.urls_json) {
      try {
        const parsed = JSON.parse(group.urls_json);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return formatOrParseUrls(group.raw_text);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Header Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '0.875rem',
          width: '100%',
        }}
      >
        <div style={{ minWidth: '220px', flex: '1 1 240px' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Add Property URLs
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem', marginBottom: 0 }}>
            Collect and store grouped post links. View and copy saved link batches directly.
          </p>
        </div>

        {/* Action Buttons Bar */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {urlGroups.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<FiTrash2 />}
              onClick={handleClearAll}
              style={{ height: '34px', fontSize: '0.78125rem', color: 'var(--text-muted)' }}
            >
              Clear All
            </Button>
          )}

          <Button
            variant="primary"
            size="sm"
            leftIcon={<FiPlus />}
            onClick={() => setIsModalOpen(true)}
            style={{ height: '34px', whiteSpace: 'nowrap' }}
          >
            Add Property URL
          </Button>
        </div>
      </div>

      {/* Alert Notification Toast */}
      {notification && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            backgroundColor: 'var(--status-info-bg)',
            color: 'var(--status-info)',
            fontSize: '0.8125rem',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            border: '1px solid var(--border-color)',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <FiCheckCircle style={{ flexShrink: 0 }} />
          <span>{notification}</span>
        </div>
      )}

      {/* Main Table: Strictly Serial, Date, View, and Copy */}
      <div
        style={{
          width: '100%',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: '0.75rem',
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '0.875rem 1.25rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', width: '120px' }}>
                  Serial
                </th>
                <th style={{ padding: '0.875rem 1.25rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Date
                </th>
                <th style={{ padding: '0.875rem 1.25rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', width: '140px', textAlign: 'center' }}>
                  View
                </th>
                <th style={{ padding: '0.875rem 1.25rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', width: '140px', textAlign: 'center' }}>
                  Copy
                </th>
                <th style={{ padding: '0.875rem 1rem', width: '60px', textAlign: 'center' }}>
                  {/* Action */}
                </th>
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    Loading saved links...
                  </td>
                </tr>
              ) : urlGroups.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '3.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                      <FiLink style={{ fontSize: '2rem', color: 'var(--text-muted)' }} />
                      <div>
                        No saved property URLs yet.
                      </div>
                      <Button
                        variant="primary"
                        size="sm"
                        leftIcon={<FiPlus />}
                        onClick={() => setIsModalOpen(true)}
                        style={{ height: '32px', fontSize: '0.78125rem' }}
                      >
                        Add Property URL
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                urlGroups.map((group, idx) => {
                  const { formatted, relative } = formatDate(group.created_at);
                  const serialDisplay = group.serial || String(idx + 1).padStart(2, '0');
                  const count = group.url_count || 1;
                  const isCopied = copiedId === group.id;

                  return (
                    <tr
                      key={group.id}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      {/* Serial */}
                      <td style={{ padding: '0.875rem 1.25rem', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span
                            style={{
                              fontSize: '0.875rem',
                              fontWeight: 700,
                              color: 'var(--accent-primary)',
                              fontFamily: 'monospace',
                              letterSpacing: '0.05em',
                            }}
                          >
                            {serialDisplay}
                          </span>
                          <span
                            style={{
                              fontSize: '0.6875rem',
                              color: 'var(--text-muted)',
                              backgroundColor: 'rgba(255, 255, 255, 0.05)',
                              padding: '0.1rem 0.45rem',
                              borderRadius: '0.25rem',
                              fontWeight: 500,
                            }}
                          >
                            {count} {count === 1 ? 'link' : 'links'}
                          </span>
                        </div>
                      </td>

                      {/* Date */}
                      <td style={{ padding: '0.875rem 1.25rem', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {formatted}
                          </span>
                          {relative && (
                            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                              {relative}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* View */}
                      <td style={{ padding: '0.875rem 1.25rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => setViewingGroup(group)}
                          style={{
                            height: '30px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.375rem',
                            padding: '0 0.75rem',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            borderRadius: '0.375rem',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'var(--accent-primary)';
                            e.currentTarget.style.color = 'var(--accent-primary)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--border-color)';
                            e.currentTarget.style.color = 'var(--text-primary)';
                          }}
                        >
                          <FiEye style={{ fontSize: '0.875rem' }} />
                          <span>View</span>
                        </button>
                      </td>

                      {/* Copy */}
                      <td style={{ padding: '0.875rem 1.25rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => handleCopyLinks(group)}
                          style={{
                            height: '30px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.375rem',
                            padding: '0 0.875rem',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            borderRadius: '0.375rem',
                            border: isCopied ? '1px solid #10B981' : '1px solid var(--border-color)',
                            backgroundColor: isCopied ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-secondary)',
                            color: isCopied ? '#10B981' : 'var(--text-primary)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            if (!isCopied) {
                              e.currentTarget.style.borderColor = 'var(--accent-primary)';
                              e.currentTarget.style.color = 'var(--accent-primary)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isCopied) {
                              e.currentTarget.style.borderColor = 'var(--border-color)';
                              e.currentTarget.style.color = 'var(--text-primary)';
                            }
                          }}
                        >
                          {isCopied ? (
                            <>
                              <FiCheck style={{ fontSize: '0.875rem' }} />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <FiCopy style={{ fontSize: '0.875rem' }} />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Delete */}
                      <td style={{ padding: '0.875rem 1rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => handleDeleteGroup(group.id)}
                          title="Delete Group"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '0.25rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '0.25rem',
                            transition: 'color 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = '#EF4444';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--text-muted)';
                          }}
                        >
                          <FiTrash2 style={{ fontSize: '0.875rem' }} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Property URLs Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !isSaving && setIsModalOpen(false)}
        title="Add Property URLs"
        maxWidth="540px"
      >
        <form onSubmit={handleSaveUrlGroup} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.4, margin: 0 }}>
            Paste one or multiple Facebook post links below (one link per line). All links will be saved together in a single row.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.78125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Facebook Post Link(s)
              </label>
              <button
                type="button"
                onClick={insertSampleTestUrls}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--accent-primary)',
                  fontSize: '0.71875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: 0,
                }}
              >
                <FiZap style={{ color: '#F59E0B' }} />
                <span>Insert Sample Facebook Test URLs</span>
              </button>
            </div>

            <textarea
              rows={6}
              placeholder={`https://facebook.com/groups/realestate/posts/101\nhttps://facebook.com/groups/realestate/posts/102`}
              value={rawUrlsText}
              onChange={(e) => handleTextareaChange(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.75rem 0.875rem',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '0.5rem',
                outline: 'none',
                fontSize: '0.8125rem',
                fontFamily: 'monospace',
                lineHeight: 1.5,
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {validUrls.length > 0 ? (
                <span style={{ color: 'var(--status-success)', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  <FiCheck /> {validUrls.length} {validUrls.length === 1 ? 'link' : 'links'} detected
                </span>
              ) : (
                <span>Paste links above or use sample test button</span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.625rem' }}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsModalOpen(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                leftIcon={<FiCheck />}
                disabled={isSaving || rawUrlsText.trim().length === 0}
              >
                {isSaving ? 'Saving...' : 'Save URLs'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* View Grouped Links Modal */}
      {viewingGroup && (
        <Modal
          isOpen={!!viewingGroup}
          onClose={() => setViewingGroup(null)}
          title={`Grouped Links — Serial ${viewingGroup.serial}`}
          maxWidth="640px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Modal Info Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span
                  style={{
                    fontSize: '1rem',
                    fontWeight: 700,
                    color: 'var(--accent-primary)',
                    fontFamily: 'monospace',
                  }}
                >
                  #{viewingGroup.serial}
                </span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: '#10B981',
                    backgroundColor: 'rgba(16, 185, 129, 0.12)',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '0.25rem',
                    fontWeight: 600,
                  }}
                >
                  {getGroupUrlsList(viewingGroup).length} Links in Group
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <FiCalendar style={{ fontSize: '0.8125rem' }} />
                <span>{formatDate(viewingGroup.created_at).formatted}</span>
              </div>
            </div>

            {/* Individual Links List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.78125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                List of URLs in this Batch
              </label>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  maxHeight: '260px',
                  overflowY: 'auto',
                  paddingRight: '0.25rem',
                }}
              >
                {getGroupUrlsList(viewingGroup).map((url, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.625rem 0.875rem',
                      borderRadius: '0.375rem',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden', flex: 1 }}>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          color: 'var(--text-muted)',
                          fontFamily: 'monospace',
                          width: '20px',
                        }}
                      >
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span
                        style={{
                          fontSize: '0.8125rem',
                          color: 'var(--text-primary)',
                          fontFamily: 'monospace',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {url}
                      </span>
                    </div>

                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      title="Open link in new tab"
                      style={{
                        color: 'var(--accent-primary)',
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                    >
                      <span>Open</span>
                      <FiExternalLink />
                    </a>
                  </div>
                ))}
              </div>
            </div>

            {/* Raw Text Box */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label style={{ fontSize: '0.78125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Raw Group Text
              </label>
              <textarea
                readOnly
                rows={4}
                value={viewingGroup.raw_text}
                style={{
                  width: '100%',
                  padding: '0.625rem 0.75rem',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '0.375rem',
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  lineHeight: 1.4,
                  resize: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewingGroup(null)}
              >
                Close
              </Button>

              <button
                type="button"
                onClick={() => handleCopyFromModal(viewingGroup)}
                style={{
                  height: '32px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  padding: '0 0.875rem',
                  fontSize: '0.78125rem',
                  fontWeight: 600,
                  borderRadius: '0.375rem',
                  border: viewModalCopied ? '1px solid #10B981' : '1px solid var(--accent-primary)',
                  backgroundColor: viewModalCopied ? 'rgba(16, 185, 129, 0.15)' : 'var(--accent-primary)',
                  color: viewModalCopied ? '#10B981' : '#FFFFFF',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {viewModalCopied ? (
                  <>
                    <FiCheck />
                    <span>Copied All Links!</span>
                  </>
                ) : (
                  <>
                    <FiCopy />
                    <span>Copy All Links</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
