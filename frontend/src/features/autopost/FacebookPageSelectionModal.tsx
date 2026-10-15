import React, { useState, useEffect } from 'react';
import {
  FiCheckCircle,
  FiAlertCircle,
  FiRefreshCw,
  FiCheck,
  FiX,
  FiExternalLink,
  FiShield,
  FiSliders,
  FiPlus,
  FiTrash2,
} from 'react-icons/fi';
import { FaFacebook } from 'react-icons/fa6';
import { SiMeta } from 'react-icons/si';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';

export interface DiscoveredPage {
  id: string;
  name: string;
  category: string;
  tasks: string[];
  link: string;
  picture_url: string;
  is_connected: boolean;
  can_publish: boolean;
}

interface FacebookPageSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPagesUpdated: () => void;
  onConnectFacebook?: () => void;
}

export const FacebookPageSelectionModal: React.FC<FacebookPageSelectionModalProps> = ({
  isOpen,
  onClose,
  onPagesUpdated,
  onConnectFacebook,
}) => {
  const [pages, setPages] = useState<DiscoveredPage[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadDiscoveredPages = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:8085/api/facebook/pages/discover');
      const data = await res.json();
      if (res.ok && Array.isArray(data.pages)) {
        setPages(data.pages);
        // Pre-select pages that are already connected, or pre-select all discovered pages by default
        const initialSelected = data.pages
          .filter((p: DiscoveredPage) => p.is_connected || p.can_publish)
          .map((p: DiscoveredPage) => p.id);
        setSelectedIds(initialSelected.length > 0 ? initialSelected : data.pages.map((p: DiscoveredPage) => p.id));
      } else {
        setError(data.message || 'No authorized pages found. Please connect your Facebook Account.');
      }
    } catch (e: any) {
      setError('Network error connecting to backend. Please check server connection.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDiscoveredPages();
    }
  }, [isOpen]);

  const toggleSelect = (pageId: string) => {
    setSelectedIds(prev =>
      prev.includes(pageId) ? prev.filter(id => id !== pageId) : [...prev, pageId]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === pages.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pages.map(p => p.id));
    }
  };

  const handleConnectSelected = async () => {
    if (selectedIds.length === 0) {
      showToast('⚠️ Please select at least one Facebook Page to connect.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('http://localhost:8085/api/facebook/pages/connect-selected', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page_ids: selectedIds }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`✅ Successfully connected ${selectedIds.length} Facebook Page(s)!`);
        onPagesUpdated();
        setTimeout(() => {
          onClose();
        }, 800);
      } else {
        showToast(`❌ Connection failed: ${data.message || 'Could not connect pages'}`);
      }
    } catch (e: any) {
      showToast('❌ Network error connecting pages');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisconnect = async (pageId: string, pageName: string) => {
    if (!window.confirm(`Disconnect Facebook Page "${pageName}" from auto-posting?`)) {
      return;
    }
    setDisconnectingId(pageId);
    try {
      const res = await fetch(`http://localhost:8085/api/facebook/pages/${pageId}/disconnect`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Disconnected "${pageName}"`);
        setSelectedIds(prev => prev.filter(id => id !== pageId));
        setPages(prev => prev.map(p => (p.id === pageId ? { ...p, is_connected: false } : p)));
        onPagesUpdated();
      } else {
        showToast(`⚠️ ${data.message || 'Failed to disconnect page'}`);
      }
    } catch (e) {
      showToast('❌ Network error disconnecting page');
    } finally {
      setDisconnectingId(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Select Facebook Pages to Connect"
      maxWidth="680px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: '380px' }}>
        {/* Toast Notification */}
        {toastMessage && (
          <div
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              backgroundColor: '#1C1E21',
              color: '#FFFFFF',
              fontSize: '0.8125rem',
              fontWeight: 500,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>{toastMessage}</span>
            <button
              onClick={() => setToastMessage(null)}
              style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', padding: 0 }}
            >
              <FiX />
            </button>
          </div>
        )}

        {/* Subtitle / Intro Banner */}
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '10px',
            backgroundColor: 'rgba(24, 119, 242, 0.06)',
            border: '1px solid rgba(24, 119, 242, 0.2)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
          }}
        >
          <SiMeta style={{ color: '#1877F2', fontSize: '1.25rem', flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1, fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
            <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '2px' }}>
              Official Meta Graph API v26.0 Page Discovery
            </strong>
            The Pages below were automatically discovered from your authorized Facebook account via <code style={{ backgroundColor: 'rgba(0,0,0,0.05)', padding: '1px 4px', borderRadius: '4px' }}>GET /me/accounts</code>. Select the Pages you want to enable for independent listing publishing.
          </div>
          {onConnectFacebook && (
            <Button
              variant="outline"
              size="sm"
              onClick={onConnectFacebook}
              style={{ fontSize: '0.6875rem', height: '28px', padding: '0 8px', flexShrink: 0 }}
            >
              Reconnect Account
            </Button>
          )}
        </div>

        {/* Controls Bar: Select All & Refresh */}
        {pages.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
            <button
              type="button"
              onClick={handleSelectAll}
              style={{
                background: 'none',
                border: 'none',
                color: '#1877F2',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '2px 6px',
              }}
            >
              {selectedIds.length === pages.length ? 'Deselect All' : 'Select All'} ({selectedIds.length}/{pages.length} selected)
            </button>

            <button
              type="button"
              onClick={loadDiscoveredPages}
              disabled={isLoading}
              style={{
                background: 'none',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '3px 8px',
                fontSize: '0.6875rem',
                color: 'var(--text-secondary)',
                cursor: isLoading ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <FiRefreshCw style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
              <span>Refresh Discovery</span>
            </button>
          </div>
        )}

        {/* Content Body */}
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '3rem 1rem' }}>
            <FiRefreshCw style={{ fontSize: '1.75rem', color: '#1877F2', animation: 'spin 1s linear infinite', marginBottom: '0.75rem' }} />
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Querying Meta Graph API /me/accounts for authorized Pages...
            </span>
          </div>
        ) : error ? (
          <div
            style={{
              padding: '2rem 1.5rem',
              borderRadius: '10px',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              backgroundColor: 'rgba(239, 68, 68, 0.05)',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <FiAlertCircle style={{ color: '#EF4444', fontSize: '2rem' }} />
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              No Facebook Pages Discovered
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '420px', lineHeight: 1.4 }}>
              {error}
            </div>
            {onConnectFacebook && (
              <Button
                variant="primary"
                size="sm"
                onClick={onConnectFacebook}
                style={{ backgroundColor: '#1877F2', borderColor: '#1877F2', marginTop: '0.5rem' }}
              >
                <SiMeta style={{ marginRight: '6px' }} />
                Connect Facebook Account
              </Button>
            )}
          </div>
        ) : pages.length === 0 ? (
          <div
            style={{
              padding: '2.5rem 1rem',
              textAlign: 'center',
              borderRadius: '10px',
              border: '1px dashed var(--border-color)',
              color: 'var(--text-muted)',
              fontSize: '0.8125rem',
            }}
          >
            No Pages found for this account. Please verify that your Facebook account has admin access to Facebook Pages.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', maxHeight: '360px', overflowY: 'auto', paddingRight: '4px' }}>
            {pages.map((page, idx) => {
              const isSelected = selectedIds.includes(page.id);

              return (
                <div
                  key={page.id}
                  onClick={() => toggleSelect(page.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: isSelected
                      ? '2px solid #1877F2'
                      : '1px solid var(--border-color)',
                    backgroundColor: isSelected ? 'rgba(24, 119, 242, 0.04)' : 'var(--bg-main)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // handled by parent onClick
                      style={{
                        width: '16px',
                        height: '16px',
                        accentColor: '#1877F2',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    />

                    {/* Page Profile Picture */}
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '8px',
                        backgroundColor: '#1877F2',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        flexShrink: 0,
                        border: '1px solid rgba(0,0,0,0.08)',
                      }}
                    >
                      {page.picture_url ? (
                        <img
                          src={page.picture_url}
                          alt={page.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <FaFacebook style={{ fontSize: '1.25rem' }} />
                      )}
                    </div>

                    {/* Page Details */}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {page.name}
                        </span>
                        {idx === 0 && (
                          <span style={{ fontSize: '0.625rem', fontWeight: 600, color: '#1877F2', backgroundColor: 'rgba(24, 119, 242, 0.1)', padding: '1px 5px', borderRadius: '4px' }}>
                            Slot 1 (Primary)
                          </span>
                        )}
                        {idx === 1 && (
                          <span style={{ fontSize: '0.625rem', fontWeight: 600, color: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '1px 5px', borderRadius: '4px' }}>
                            Slot 2 (Secondary)
                          </span>
                        )}
                        {idx > 1 && (
                          <span style={{ fontSize: '0.625rem', fontWeight: 600, color: '#8B5CF6', backgroundColor: 'rgba(139, 92, 246, 0.1)', padding: '1px 5px', borderRadius: '4px' }}>
                            Slot {idx + 1}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                        <span style={{ fontFamily: 'monospace' }}>ID: {page.id}</span>
                        {page.category && <span>• {page.category}</span>}
                        {page.can_publish ? (
                          <span style={{ color: '#22C55E', fontWeight: 600 }}>• CREATE_CONTENT Granted</span>
                        ) : (
                          <span style={{ color: '#F59E0B', fontWeight: 600 }}>• Limited Tasks</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    {page.is_connected && (
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          color: '#22C55E',
                          backgroundColor: 'rgba(34, 197, 94, 0.12)',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <FiCheckCircle />
                        Connected
                      </span>
                    )}

                    {page.is_connected && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDisconnect(page.id, page.name);
                        }}
                        disabled={disconnectingId === page.id}
                        style={{
                          background: 'none',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          borderRadius: '6px',
                          color: '#EF4444',
                          fontSize: '0.6875rem',
                          padding: '3px 8px',
                          cursor: disconnectingId === page.id ? 'wait' : 'pointer',
                        }}
                        title="Disconnect page"
                      >
                        {disconnectingId === page.id ? 'Disconnecting...' : 'Disconnect'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '0.875rem',
            borderTop: '1px solid var(--border-color)',
            marginTop: 'auto',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Selected Pages will have dedicated independent content and auto-posting controls.
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConnectSelected}
              disabled={isSubmitting || selectedIds.length === 0}
              style={{ backgroundColor: '#1877F2', borderColor: '#1877F2', minWidth: '160px' }}
            >
              {isSubmitting ? (
                <span>Connecting...</span>
              ) : (
                <span>Connect {selectedIds.length} Selected Page{selectedIds.length === 1 ? '' : 's'}</span>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
