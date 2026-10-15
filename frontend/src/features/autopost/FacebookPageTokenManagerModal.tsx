import React, { useState, useEffect } from 'react';
import {
  FiCheckCircle,
  FiAlertCircle,
  FiRefreshCw,
  FiExternalLink,
  FiLock,
  FiKey,
  FiSliders,
  FiTrash2,
  FiShield,
  FiClock,
  FiInfo,
  FiCheck,
  FiX,
  FiEdit3,
  FiEye,
  FiEyeOff,
  FiCopy,
} from 'react-icons/fi';
import { FaFacebook } from 'react-icons/fa6';
import { SiMeta } from 'react-icons/si';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { type ManagedPageMeta } from './autoPostStorage';

interface FacebookPageTokenManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPagesUpdated?: () => void;
}

export const FacebookPageTokenManagerModal: React.FC<FacebookPageTokenManagerModalProps> = ({
  isOpen,
  onClose,
  onPagesUpdated,
}) => {
  const [pages, setPages] = useState<ManagedPageMeta[]>([]);
  const [metaAppId, setMetaAppId] = useState('967687235797751');
  const [graphVersion, setGraphVersion] = useState('v26.0');
  const [isLoading, setIsLoading] = useState(false);
  const [testingPageId, setTestingPageId] = useState<string | null>(null);
  const [isTestingAll, setIsTestingAll] = useState(false);
  const [savingPageId, setSavingPageId] = useState<string | null>(null);
  const [editingTokenPageId, setEditingTokenPageId] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [userTokenInput, setUserTokenInput] = useState('');
  const [isImportingUserToken, setIsImportingUserToken] = useState(false);
  const [editingLabelPageId, setEditingLabelPageId] = useState<string | null>(null);
  const [labelInput, setLabelInput] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [revealedTokens, setRevealedTokens] = useState<Record<string, string>>({});
  const [loadingTokens, setLoadingTokens] = useState<Record<string, boolean>>({});
  const [copiedTokenPageId, setCopiedTokenPageId] = useState<string | null>(null);

  const handleToggleRevealToken = async (pageId: string) => {
    if (revealedTokens[pageId]) {
      setRevealedTokens(prev => {
        const next = { ...prev };
        delete next[pageId];
        return next;
      });
      return;
    }
    setLoadingTokens(prev => ({ ...prev, [pageId]: true }));
    try {
      const res = await fetch(`http://localhost:8085/api/facebook/pages/${pageId}/token`);
      const data = await res.json();
      if (res.ok && data.token) {
        setRevealedTokens(prev => ({ ...prev, [pageId]: data.token }));
        showToast(`Token for Page ${pageId} revealed`);
      } else {
        showToast(data.message || 'Failed to retrieve token');
      }
    } catch (e: any) {
      showToast('Error: ' + e.message);
    } finally {
      setLoadingTokens(prev => ({ ...prev, [pageId]: false }));
    }
  };

  const handleCopyToken = (pageId: string, token: string) => {
    navigator.clipboard.writeText(token);
    setCopiedTokenPageId(pageId);
    showToast('Token copied to clipboard!');
    setTimeout(() => setCopiedTokenPageId(null), 2500);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadPages = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('http://localhost:8085/api/facebook/pages');
      if (res.ok) {
        const data = await res.json();
        if (data.pages) {
          setPages(data.pages);
        }
        if (data.meta_app_id) setMetaAppId(data.meta_app_id);
        if (data.graph_api_version) setGraphVersion(data.graph_api_version);
      }
    } catch (e) {
      console.error('Failed to load managed Facebook pages:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadPages();
    }
  }, [isOpen]);

  const handleTestPage = async (pageId: string) => {
    setTestingPageId(pageId);
    try {
      const res = await fetch(`http://localhost:8085/api/facebook/pages/${pageId}/test`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.test_result) {
        if (data.test_result.passed) {
          showToast(`✅ Page ${pageId} test PASSED! Token is valid with CREATE_CONTENT.`);
        } else {
          showToast(`⚠️ Page ${pageId} test: ${data.test_result.message}`);
        }
        await loadPages();
        if (onPagesUpdated) onPagesUpdated();
      } else {
        showToast(`❌ Test failed: ${data.message || 'Unknown error'}`);
      }
    } catch (e: any) {
      showToast('❌ Network error testing page');
    } finally {
      setTestingPageId(null);
    }
  };

  const handleTestAllPages = async () => {
    setIsTestingAll(true);
    try {
      const res = await fetch('http://localhost:8085/api/facebook/pages/test-all', {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        if (data.all_passed) {
          showToast('🎉 All Facebook Pages verified and ready for auto-publishing!');
        } else {
          showToast('⚠️ Some pages failed verification. Check individual status.');
        }
        await loadPages();
        if (onPagesUpdated) onPagesUpdated();
      }
    } catch (e) {
      showToast('❌ Network error testing all pages');
    } finally {
      setIsTestingAll(false);
    }
  };

  const handleSavePageToken = async (pageId: string) => {
    if (!tokenInput.trim()) {
      showToast('⚠️ Please enter a token');
      return;
    }
    setSavingPageId(pageId);
    try {
      const res = await fetch(`http://localhost:8085/api/facebook/pages/${pageId}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenInput.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        showToast(`✅ Token for Page ${pageId} saved & verified!`);
        setEditingTokenPageId(null);
        setTokenInput('');
        await loadPages();
        if (onPagesUpdated) onPagesUpdated();
      } else {
        showToast(`❌ ${data.message || 'Failed to save token'}`);
      }
    } catch (e: any) {
      showToast('❌ Network error saving token');
    } finally {
      setSavingPageId(null);
    }
  };

  const handleImportUserToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userTokenInput.trim()) {
      showToast('⚠️ Please paste a User Access Token');
      return;
    }
    setIsImportingUserToken(true);
    try {
      const res = await fetch('http://localhost:8085/api/facebook/pages/import-user-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_token: userTokenInput.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        showToast('🎉 Both Pages successfully imported & validated from User Token!');
        setUserTokenInput('');
        await loadPages();
        if (onPagesUpdated) onPagesUpdated();
      } else {
        showToast(`❌ ${data.message || 'Failed to import user token'}`);
      }
    } catch (e: any) {
      showToast('❌ Network error importing user token');
    } finally {
      setIsImportingUserToken(false);
    }
  };

  const handleToggleAutoPublish = async (page: ManagedPageMeta) => {
    const nextState = !page.auto_publish_enabled;
    try {
      const res = await fetch(`http://localhost:8085/api/facebook/pages/${page.page_id}/auto-publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextState }),
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        showToast(`${nextState ? '✅ Enabled' : '⏸️ Paused'} auto-publishing for Page ${page.slot}`);
        await loadPages();
        if (onPagesUpdated) onPagesUpdated();
      } else {
        showToast(`⚠️ ${data.message || 'Cannot enable auto-publish'}`);
      }
    } catch (e) {
      showToast('❌ Network error');
    }
  };

  const handleSaveLabel = async (pageId: string) => {
    try {
      const res = await fetch(`http://localhost:8085/api/facebook/pages/${pageId}/label`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: labelInput.trim() }),
      });
      if (res.ok) {
        showToast('Label updated');
        setEditingLabelPageId(null);
        await loadPages();
        if (onPagesUpdated) onPagesUpdated();
      }
    } catch (e) {}
  };

  const handleRemoveToken = async (pageId: string) => {
    if (!confirm(`Are you sure you want to remove the stored token for Page ${pageId}?`)) {
      return;
    }
    try {
      const res = await fetch(`http://localhost:8085/api/facebook/pages/${pageId}/token`, {
        method: 'DELETE',
      });
      if (res.ok) {
        showToast('Token removed');
        await loadPages();
        if (onPagesUpdated) onPagesUpdated();
      }
    } catch (e) {}
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'VALID':
        return '#22C55E';
      case 'EXPIRED':
        return '#EF4444';
      case 'MISSING':
        return '#F59E0B';
      default:
        return '#3B82F6';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Facebook Page Token Management">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.25rem 0', maxWidth: '780px' }}>
        {/* Toast Alert */}
        {toastMessage && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              backgroundColor: 'rgba(34, 197, 94, 0.12)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              color: '#15803D',
              fontSize: '0.8125rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <FiCheckCircle />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Header App Info Banner */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderRadius: '10px',
            backgroundColor: 'rgba(24, 119, 242, 0.08)',
            border: '1px solid rgba(24, 119, 242, 0.25)',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                backgroundColor: '#1877F2',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
              }}
            >
              <SiMeta />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Meta Developer App (Dual-Page Auto Post)
                </span>
                <span
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: '#1877F2',
                    color: '#FFFFFF',
                  }}
                >
                  {graphVersion}
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                App ID: <strong>{metaAppId}</strong> · Separate Page Tokens · Zero Content Mixing
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={handleTestAllPages}
            disabled={isTestingAll || pages.length === 0}
            style={{
              height: '34px',
              fontSize: '0.75rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderColor: 'rgba(24, 119, 242, 0.4)',
              color: '#1877F2',
            }}
          >
            <FiRefreshCw style={{ animation: isTestingAll ? 'spin 1s linear infinite' : 'none' }} />
            <span>{isTestingAll ? 'Testing Both...' : 'Test All Pages'}</span>
          </Button>
        </div>

        {/* Notice on Isolation */}
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '8px',
            backgroundColor: 'var(--bg-main)',
            border: '1px solid var(--border-color)',
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.45,
          }}
        >
          🔒 <strong>Strict Token & Content Isolation:</strong> Each Facebook Page holds its OWN encrypted Page Access Token and publishing schedule. Posts targeted to Page 1 will NEVER be published to Page 2, and vice-versa. Automatic publishing is only enabled after a live access test passes.
        </div>

        {/* Managed Pages List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {pages.map((p) => {
            const isEditingToken = editingTokenPageId === p.page_id;
            const isEditingLabel = editingLabelPageId === p.page_id;
            const isTesting = testingPageId === p.page_id;
            const isSaving = savingPageId === p.page_id;

            return (
              <div
                key={p.page_id}
                style={{
                  border: `2px solid ${p.test_passed ? 'rgba(34, 197, 94, 0.35)' : 'var(--border-color)'}`,
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-secondary)',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.875rem',
                  boxShadow: p.test_passed ? '0 4px 16px rgba(34, 197, 94, 0.06)' : 'none',
                }}
              >
                {/* Page Card Top Row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '8px',
                        backgroundColor: p.slot === 1 ? '#1877F2' : '#8B5CF6',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '0.875rem',
                        overflow: 'hidden',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      {p.picture_url ? (
                        <img
                          src={p.picture_url}
                          alt={p.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        `P${p.slot}`
                      )}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isEditingLabel ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input
                              type="text"
                              value={labelInput}
                              onChange={(e) => setLabelInput(e.target.value)}
                              placeholder="Label (e.g. Luxury Rentals)"
                              style={{
                                padding: '3px 8px',
                                fontSize: '0.8125rem',
                                borderRadius: '4px',
                                border: '1px solid var(--border-color)',
                                backgroundColor: 'var(--bg-main)',
                                color: 'var(--text-primary)',
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveLabel(p.page_id)}
                              style={{ border: 'none', background: '#22C55E', color: '#FFF', borderRadius: '4px', padding: '3px 6px', fontSize: '0.75rem', cursor: 'pointer' }}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingLabelPageId(null)}
                              style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <>
                            <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {p.label || `Page ${p.slot}`}: {p.name}
                            </h4>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingLabelPageId(p.page_id);
                                setLabelInput(p.label || `Page ${p.slot}`);
                              }}
                              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                              title="Rename label"
                            >
                              <FiEdit3 style={{ fontSize: '0.8125rem' }} />
                            </button>
                          </>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', fontSize: '0.75rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Page ID:</span>
                        <strong style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{p.page_id}</strong>
                        <a
                          href={p.page_url || `https://www.facebook.com/profile.php?id=${p.page_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#1877F2', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                        >
                          <span>Open on FB</span>
                          <FiExternalLink />
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Status Badge & Auto-Publish Toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        backgroundColor: `${statusColor(p.token_status)}1A`,
                        color: statusColor(p.token_status),
                        border: `1px solid ${statusColor(p.token_status)}40`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}
                    >
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: statusColor(p.token_status) }} />
                      {p.token_status === 'VALID'
                        ? (p.test_passed ? 'Ready' : 'Valid')
                        : p.token_status
                        ? p.token_status.charAt(0).toUpperCase() + p.token_status.slice(1).toLowerCase()
                        : 'Missing'}
                    </span>

                    {/* Auto Publish Switch */}
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: p.test_passed ? 'pointer' : 'not-allowed',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        opacity: p.test_passed ? 1 : 0.6,
                      }}
                      title={p.test_passed ? 'Toggle automatic scheduled posting' : 'Test must pass before enabling auto-publishing'}
                    >
                      <span>Auto-Publish</span>
                      <input
                        type="checkbox"
                        checked={p.auto_publish_enabled}
                        disabled={!p.test_passed}
                        onChange={() => handleToggleAutoPublish(p)}
                        style={{ accentColor: '#22C55E', cursor: p.test_passed ? 'pointer' : 'not-allowed' }}
                      />
                    </label>
                  </div>
                </div>

                {/* Token Details & Test Row */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <FiKey style={{ color: p.has_token ? '#22C55E' : '#F59E0B', fontSize: '1rem' }} />
                    <div style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Token: </span>
                      {p.has_token ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <strong
                            style={{
                              fontFamily: 'monospace',
                              color: 'var(--text-primary)',
                              wordBreak: revealedTokens[p.page_id] ? 'break-all' : 'normal',
                              maxWidth: '220px',
                            }}
                          >
                            {revealedTokens[p.page_id] || p.token_hint || '••••••••'} {!revealedTokens[p.page_id] && '(AES-256)'}
                          </strong>
                          <button
                            type="button"
                            onClick={() => handleToggleRevealToken(p.page_id)}
                            disabled={loadingTokens[p.page_id]}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: '#1877F2',
                              padding: '2px 4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '2px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                            }}
                            title={revealedTokens[p.page_id] ? 'Hide token' : 'View full token'}
                          >
                            {loadingTokens[p.page_id] ? (
                              <FiRefreshCw style={{ animation: 'spin 1s linear infinite' }} />
                            ) : revealedTokens[p.page_id] ? (
                              <>
                                <FiEyeOff />
                                <span>Hide</span>
                              </>
                            ) : (
                              <>
                                <FiEye />
                                <span>View</span>
                              </>
                            )}
                          </button>
                          {revealedTokens[p.page_id] && (
                            <button
                              type="button"
                              onClick={() => handleCopyToken(p.page_id, revealedTokens[p.page_id])}
                              style={{
                                background: 'rgba(24, 119, 242, 0.1)',
                                border: '1px solid rgba(24, 119, 242, 0.25)',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                color: copiedTokenPageId === p.page_id ? '#22C55E' : '#1877F2',
                                padding: '1px 6px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px',
                                fontSize: '0.6875rem',
                                fontWeight: 600,
                              }}
                              title="Copy full token"
                            >
                              {copiedTokenPageId === p.page_id ? <FiCheck /> : <FiCopy />}
                              <span>{copiedTokenPageId === p.page_id ? 'Copied' : 'Copy'}</span>
                            </button>
                          )}
                        </span>
                      ) : (
                        <span style={{ color: '#F59E0B', fontWeight: 600 }}>No token stored</span>
                      )}
                      {p.token_never_expires && (
                        <span style={{ marginLeft: '8px', color: '#22C55E', fontSize: '0.6875rem', fontWeight: 600 }}>
                          • Never Expires
                        </span>
                      )}
                      {p.token_expires_in_days !== undefined && p.token_expires_in_days !== null && (
                        <span style={{ marginLeft: '8px', color: p.token_expires_in_days < 7 ? '#EF4444' : 'var(--text-muted)', fontSize: '0.6875rem' }}>
                          • Expires in {p.token_expires_in_days} days
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Button
                      variant="outline"
                      onClick={() => handleTestPage(p.page_id)}
                      disabled={!p.has_token || isTesting}
                      style={{
                        height: '30px',
                        padding: '0 10px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        color: p.test_passed ? '#22C55E' : '#1877F2',
                        borderColor: p.test_passed ? 'rgba(34, 197, 94, 0.4)' : 'rgba(24, 119, 242, 0.3)',
                      }}
                    >
                      <FiRefreshCw style={{ animation: isTesting ? 'spin 1s linear infinite' : 'none' }} />
                      <span>{isTesting ? 'Testing...' : 'Test Access'}</span>
                    </Button>

                    <Button
                      variant="secondary"
                      onClick={() => {
                        if (isEditingToken) {
                          setEditingTokenPageId(null);
                        } else {
                          setEditingTokenPageId(p.page_id);
                          setTokenInput('');
                        }
                      }}
                      style={{ height: '30px', padding: '0 10px', fontSize: '0.75rem', fontWeight: 600 }}
                    >
                      {isEditingToken ? 'Cancel' : p.has_token ? 'Rotate Token' : 'Add Token'}
                    </Button>

                    {p.has_token && (
                      <button
                        type="button"
                        onClick={() => handleRemoveToken(p.page_id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '4px',
                        }}
                        title="Delete stored token"
                      >
                        <FiTrash2 />
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline Token Input Form if editing */}
                {isEditingToken && (
                  <div
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(24, 119, 242, 0.05)',
                      border: '1px dashed rgba(24, 119, 242, 0.4)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Enter Page Access Token for Page {p.slot} ({p.page_id}) *
                    </label>
                    <textarea
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                      rows={3}
                      placeholder={`Paste Page ${p.slot} Access Token with pages_manage_posts and CREATE_CONTENT...`}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-main)',
                        color: 'var(--text-primary)',
                        fontSize: '0.8125rem',
                        fontFamily: 'monospace',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <Button
                        variant="secondary"
                        onClick={() => setEditingTokenPageId(null)}
                        style={{ height: '30px', fontSize: '0.75rem' }}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        onClick={() => handleSavePageToken(p.page_id)}
                        disabled={isSaving || !tokenInput.trim()}
                        style={{ height: '30px', fontSize: '0.75rem', backgroundColor: '#1877F2', borderColor: '#1877F2' }}
                      >
                        {isSaving ? 'Validating...' : 'Encrypt & Save Token'}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Permissions & Errors Status Bar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px', fontSize: '0.6875rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: p.can_create_content ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: p.can_create_content ? '#22C55E' : '#EF4444',
                        fontWeight: 700,
                      }}
                    >
                      Create Content: {p.can_create_content ? 'Granted ✓' : 'Not Verified'}
                    </span>
                    {p.permissions && p.permissions.slice(0, 3).map((perm) => (
                      <span
                        key={perm}
                        style={{
                          padding: '2px 5px',
                          borderRadius: '4px',
                          backgroundColor: 'var(--bg-main)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {perm} ✓
                      </span>
                    ))}
                  </div>

                  {p.last_tested_at && (
                    <span style={{ color: 'var(--text-muted)' }}>
                      Last tested: {new Date(p.last_tested_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>

                {p.last_error && !p.test_passed && (
                  <div
                    style={{
                      padding: '6px 10px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      color: '#DC2626',
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <FiAlertCircle style={{ flexShrink: 0 }} />
                    <span>{p.last_error}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Option 2: 1-Click Import Both Pages via User Access Token */}
        <div
          style={{
            padding: '1.25rem',
            borderRadius: '12px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <SiMeta style={{ color: '#1877F2', fontSize: '1.125rem' }} />
            <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              1-Click Link: Import Both Pages from Meta User Access Token
            </h4>
          </div>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
            Generate a User Access Token in Meta Graph API Explorer with <code>pages_show_list</code> and <code>pages_manage_posts</code>. Paste it below, and the system will automatically query <code>/me/accounts</code> and save each Page's separate, permanent Page Token.
          </p>

          <form onSubmit={handleImportUserToken} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <textarea
              value={userTokenInput}
              onChange={(e) => setUserTokenInput(e.target.value)}
              rows={2}
              placeholder="Paste EA... User Access Token here to auto-link Page 1 and Page 2 together..."
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-primary)',
                fontSize: '0.8125rem',
                fontFamily: 'monospace',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="primary"
                type="submit"
                disabled={isImportingUserToken || !userTokenInput.trim()}
                style={{
                  backgroundColor: '#1877F2',
                  borderColor: '#1877F2',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <FiRefreshCw style={{ animation: isImportingUserToken ? 'spin 1s linear infinite' : 'none' }} />
                <span>{isImportingUserToken ? 'Importing Both Pages...' : 'Extract & Link Both Pages'}</span>
              </Button>
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
};
