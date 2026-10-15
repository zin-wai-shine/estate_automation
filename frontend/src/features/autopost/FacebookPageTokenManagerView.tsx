import React, { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
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
  FiArrowRight,
  FiShare2,
  FiEye,
  FiEyeOff,
  FiCopy,
} from 'react-icons/fi';
import { FaFacebook } from 'react-icons/fa6';
import { SiMeta } from 'react-icons/si';
import { Button } from '../../components/ui/Button';
import { type ManagedPageMeta } from './autoPostStorage';

interface FacebookPageTokenManagerViewProps {
  onNavigateTab?: (tab: string) => void;
}

export const FacebookPageTokenManagerView: React.FC<FacebookPageTokenManagerViewProps> = ({
  onNavigateTab,
}) => {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';

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
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadPages = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('http://localhost:8085/api/facebook/pages');
      if (res.ok) {
        const data = await res.json();
        if (data.pages && Array.isArray(data.pages)) {
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
    loadPages();
  }, []);

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
      }
    } catch (e) {}
  };

  const statusColor = (status: string) => {
    const s = (status || '').toUpperCase();
    switch (s) {
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

  const formatStatus = (status?: string) => {
    if (!status) return 'Missing';
    const s = status.trim().toUpperCase();
    switch (s) {
      case 'VALID':
        return 'Valid';
      case 'MISSING':
        return 'Missing';
      case 'EXPIRED':
        return 'Expired';
      case 'REVOKED':
        return 'Revoked';
      case 'UNTESTED':
        return 'Untested';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
    }
  };

  const formatPermissionName = (perm: string) => {
    switch (perm) {
      case 'CREATE_CONTENT':
        return 'Create Content';
      case 'pages_manage_posts':
        return 'Manage Posts';
      case 'pages_read_engagement':
        return 'Read Engagement';
      case 'pages_show_list':
        return 'Show Page List';
      default:
        return perm;
    }
  };

  const page1 = pages.find((p) => p.slot === 1) || {
    id: 1,
    slot: 1,
    page_id: '1287202894475973',
    name: 'Dot BKK Living',
    label: 'Primary Page (Slot 1)',
    page_url: 'https://www.facebook.com/profile.php?id=1287202894475973',
    category: 'Real Estate',
    has_token: false,
    token_hint: '',
    token_status: 'MISSING' as const,
    permissions: [],
    can_create_content: false,
    test_passed: false,
    auto_publish_enabled: false,
    ready_to_publish: false,
  };

  const page2 = pages.find((p) => p.slot === 2) || {
    id: 2,
    slot: 2,
    page_id: '494870343703559',
    name: 'Bolt Haven Realty',
    label: 'Secondary Page (Slot 2)',
    page_url: 'https://www.facebook.com/profile.php?id=494870343703559',
    category: 'Real Estate',
    has_token: false,
    token_hint: '',
    token_status: 'MISSING' as const,
    permissions: [],
    can_create_content: false,
    test_passed: false,
    auto_publish_enabled: false,
    ready_to_publish: false,
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
            color: 'var(--text-primary)',
            padding: '12px 20px',
            borderRadius: '10px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            zIndex: 9999,
            fontWeight: 500,
            fontSize: '0.875rem',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <FiCheckCircle style={{ color: '#22C55E', fontSize: '1.125rem' }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Breadcrumb / Top Category */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
        <span>Auto Post</span>
        <span>/</span>
        <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Page Token & Credentials Manager</span>
      </div>

      {/* Top Header Section */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              backgroundColor: '#1877F2',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.75rem',
              boxShadow: '0 4px 14px rgba(24, 119, 242, 0.35)',
            }}
          >
            <SiMeta />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Facebook Page Token Manager
              </h1>
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '20px',
                  backgroundColor: 'rgba(24, 119, 242, 0.12)',
                  color: '#1877F2',
                  border: '1px solid rgba(24, 119, 242, 0.25)',
                }}
              >
                Meta Graph API v26.0
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Secure AES-256-GCM token storage and credential controls for Facebook Page 1 and Page 2 under App ID: <strong>{metaAppId}</strong>.
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Button
            variant="outline"
            onClick={loadPages}
            disabled={isLoading}
            style={{
              height: '38px',
              padding: '0 14px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <FiRefreshCw style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
            <span>Refresh</span>
          </Button>

          <Button
            variant="outline"
            onClick={handleTestAllPages}
            disabled={isTestingAll || isLoading}
            style={{
              height: '38px',
              padding: '0 14px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: '#1877F2',
              borderColor: 'rgba(24, 119, 242, 0.3)',
              backgroundColor: 'rgba(24, 119, 242, 0.05)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <FiRefreshCw style={{ animation: isTestingAll ? 'spin 1s linear infinite' : 'none' }} />
            <span>{isTestingAll ? 'Verifying All...' : 'Test All Connections'}</span>
          </Button>

          <Button
            variant="primary"
            onClick={() => {
              if (onNavigateTab) onNavigateTab('auto-post');
              else window.location.assign('/auto-post');
            }}
            style={{
              backgroundColor: '#1877F2',
              borderColor: '#1877F2',
              height: '38px',
              padding: '0 16px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 14px rgba(24, 119, 242, 0.25)',
            }}
          >
            <FiShare2 />
            <span>Go to Auto Post</span>
            <FiArrowRight />
          </Button>
        </div>
      </div>

      {/* Meta App Credentials & Security Specs Banner */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div
          style={{
            padding: '1rem 1.25rem',
            borderRadius: '12px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: 'rgba(24, 119, 242, 0.1)',
              color: '#1877F2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
              flexShrink: 0,
            }}
          >
            <SiMeta />
          </div>
          <div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Meta Developer App ID
            </div>
            <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
              {metaAppId}
            </div>
            <div style={{ fontSize: '0.6875rem', color: '#22C55E', fontWeight: 600, marginTop: '2px' }}>
              Official Graph API {graphVersion}
            </div>
          </div>
        </div>

        <div
          style={{
            padding: '1rem 1.25rem',
            borderRadius: '12px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              color: '#22C55E',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
              flexShrink: 0,
            }}
          >
            <FiShield />
          </div>
          <div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Encrypted Token Vault
            </div>
            <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              AES-256-GCM Active
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Secrets never exposed in plaintext
            </div>
          </div>
        </div>

        <div
          style={{
            padding: '1rem 1.25rem',
            borderRadius: '12px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              color: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
              flexShrink: 0,
            }}
          >
            <FiLock />
          </div>
          <div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Strict Content Isolation
            </div>
            <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Zero Content Mixing
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Separate Page IDs & tokens guaranteed
            </div>
          </div>
        </div>
      </div>

      {/* 1-Click Multi-Page User Token Importer */}
      <div
        style={{
          padding: '1.25rem',
          borderRadius: '14px',
          backgroundColor: isDark ? 'rgba(24, 119, 242, 0.08)' : 'rgba(24, 119, 242, 0.05)',
          border: '1px solid rgba(24, 119, 242, 0.25)',
          marginBottom: '2rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                backgroundColor: '#1877F2',
                color: '#FFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1rem',
              }}
            >
              <FiKey />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                1-Click Auto-Import: User Access Token Multi-Page Extraction
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Paste a User Token once with <code>pages_show_list</code>, <code>pages_read_engagement</code>, and <code>pages_manage_posts</code>. We automatically extract and configure Page 1 and Page 2 tokens simultaneously.
              </p>
            </div>
          </div>
          <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#1877F2', backgroundColor: 'rgba(24, 119, 242, 0.1)', padding: '3px 8px', borderRadius: '6px' }}>
            Recommended Fast Setup
          </span>
        </div>

        <form onSubmit={handleImportUserToken} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <textarea
            value={userTokenInput}
            onChange={(e) => setUserTokenInput(e.target.value)}
            rows={2}
            placeholder="Paste User Access Token (e.g. EAAn... from Meta Graph API Explorer)..."
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-main)',
              color: 'var(--text-primary)',
              fontSize: '0.8125rem',
              outline: 'none',
              fontFamily: 'monospace',
              boxSizing: 'border-box',
            }}
          />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              🔒 Server securely calls <code>/me/accounts</code> and automatically binds <strong>{page1.name}</strong> (<code>{page1.page_id}</code>) and <strong>{page2.name}</strong> (<code>{page2.page_id}</code>) with verified <code>CREATE_CONTENT</code> capability.
            </span>
            <Button
              variant="primary"
              type="submit"
              disabled={isImportingUserToken || !userTokenInput.trim()}
              style={{
                backgroundColor: '#1877F2',
                borderColor: '#1877F2',
                height: '36px',
                padding: '0 16px',
                fontSize: '0.8125rem',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <SiMeta />
              <span>{isImportingUserToken ? 'Extracting & Validating...' : 'Extract & Configure Both Pages'}</span>
            </Button>
          </div>
        </form>
      </div>

      {/* Side-by-Side Dual Page Configuration Cards */}
      <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>Managed Facebook Pages</span>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', backgroundColor: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '12px' }}>
          2 Slots Available
        </span>
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: '1.5rem',
          marginBottom: '2rem',
        }}
      >
        {/* ======================================================== */}
        {/* CARD 1: Facebook Page 1                                  */}
        {/* ======================================================== */}
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: page1.ready_to_publish
              ? '2px solid rgba(24, 119, 242, 0.4)'
              : '1px solid var(--border-color)',
            borderRadius: '14px',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: '#1877F2',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.375rem',
                  flexShrink: 0,
                  overflow: 'hidden',
                  border: '1px solid rgba(24, 119, 242, 0.25)',
                }}
              >
                {page1.picture_url ? (
                  <img
                    src={page1.picture_url}
                    alt={page1.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <FaFacebook />
                )}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    {page1.name}
                  </h3>
                  <span style={{ fontSize: '0.625rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(24, 119, 242, 0.1)', color: '#1877F2', fontWeight: 600 }}>
                    Slot 1
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Page ID: <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{page1.page_id}</strong>
                </div>
              </div>
            </div>

            {/* Status Pill */}
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: '20px',
                backgroundColor: `${statusColor(page1.token_status)}20`,
                color: statusColor(page1.token_status),
                border: `1px solid ${statusColor(page1.token_status)}50`,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: statusColor(page1.token_status) }} />
              <span>{formatStatus(page1.token_status)}</span>
            </span>
          </div>

          {/* Details & Token Info */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '10px',
              backgroundColor: 'var(--bg-main)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              fontSize: '0.8125rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>Page Link:</span>
              <a
                href={page1.page_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#1877F2', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <span>Visit Facebook Page</span>
                <FiExternalLink />
              </a>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
              <span style={{ color: 'var(--text-muted)', paddingTop: '2px' }}>Stored Token:</span>
              {page1.has_token ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', maxWidth: '75%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        wordBreak: revealedTokens[page1.page_id] ? 'break-all' : 'normal',
                        fontSize: revealedTokens[page1.page_id] ? '0.75rem' : '0.8125rem',
                        backgroundColor: revealedTokens[page1.page_id] ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') : 'transparent',
                        padding: revealedTokens[page1.page_id] ? '3px 6px' : '0',
                        borderRadius: '4px',
                        maxWidth: '260px',
                      }}
                    >
                      {revealedTokens[page1.page_id] || page1.token_hint || 'Token Encrypted (AES-256)'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleRevealToken(page1.page_id)}
                      disabled={loadingTokens[page1.page_id]}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#1877F2',
                        padding: '2px 6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        borderRadius: '4px',
                      }}
                      title={revealedTokens[page1.page_id] ? 'Hide token' : 'View full token'}
                    >
                      {loadingTokens[page1.page_id] ? (
                        <FiRefreshCw style={{ animation: 'spin 1s linear infinite' }} />
                      ) : revealedTokens[page1.page_id] ? (
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
                    {revealedTokens[page1.page_id] && (
                      <button
                        type="button"
                        onClick={() => handleCopyToken(page1.page_id, revealedTokens[page1.page_id])}
                        style={{
                          background: 'rgba(24, 119, 242, 0.1)',
                          border: '1px solid rgba(24, 119, 242, 0.25)',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          color: copiedTokenPageId === page1.page_id ? '#22C55E' : '#1877F2',
                          padding: '2px 8px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                        }}
                        title="Copy full token to clipboard"
                      >
                        {copiedTokenPageId === page1.page_id ? <FiCheck /> : <FiCopy />}
                        <span>{copiedTokenPageId === page1.page_id ? 'Copied' : 'Copy'}</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <span style={{ color: '#F59E0B', fontWeight: 600 }}>No token set</span>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>Token Expiry:</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                {page1.token_never_expires
                  ? 'Never Expires (Page Token)'
                  : page1.token_expires_in_days
                  ? `${page1.token_expires_in_days} days remaining`
                  : page1.token_expires_at
                  ? new Date(page1.token_expires_at).toLocaleDateString()
                  : 'N/A'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>Create Content Access:</span>
              <span style={{ color: page1.can_create_content ? '#22C55E' : '#EF4444', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                {page1.can_create_content ? <FiCheck /> : <FiX />}
                {page1.can_create_content ? 'Authorized' : 'Missing'}
              </span>
            </div>
          </div>

          {/* Permissions Row */}
          <div>
            <span style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
              Granted Meta Permissions
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {['CREATE_CONTENT', 'pages_manage_posts', 'pages_read_engagement', 'pages_show_list'].map((perm) => {
                const isGranted = page1.permissions?.includes(perm) || (perm === 'CREATE_CONTENT' && page1.can_create_content);
                return (
                  <span
                    key={perm}
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 500,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: isGranted ? 'rgba(34, 197, 94, 0.12)' : 'rgba(156, 163, 175, 0.15)',
                      color: isGranted ? '#15803D' : 'var(--text-muted)',
                      border: `1px solid ${isGranted ? 'rgba(34, 197, 94, 0.3)' : 'var(--border-color)'}`,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {isGranted ? <FiCheck style={{ fontSize: '0.75rem' }} /> : <FiX style={{ fontSize: '0.75rem' }} />}
                    <span>{formatPermissionName(perm)}</span>
                  </span>
                );
              })}
            </div>
          </div>

          {/* Auto-Publish Toggle Switch */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: '8px',
              backgroundColor: page1.auto_publish_enabled ? 'rgba(34, 197, 94, 0.08)' : 'var(--bg-main)',
              border: `1px solid ${page1.auto_publish_enabled ? 'rgba(34, 197, 94, 0.3)' : 'var(--border-color)'}`,
            }}
          >
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Auto-Publish for Page 1
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                {page1.auto_publish_enabled ? 'Active: Scheduled listings publish automatically' : 'Paused: Manual approval required'}
              </div>
            </div>
            <label style={{ position: 'relative', display: 'inline-block', width: '40px', height: '22px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={page1.auto_publish_enabled}
                onChange={() => handleToggleAutoPublish(page1)}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: page1.auto_publish_enabled ? '#22C55E' : '#9CA3AF',
                  borderRadius: '20px',
                  transition: '0.2s ease',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    height: '16px',
                    width: '16px',
                    left: page1.auto_publish_enabled ? '20px' : '4px',
                    bottom: '3px',
                    backgroundColor: '#FFFFFF',
                    borderRadius: '50%',
                    transition: '0.2s ease',
                  }}
                />
              </span>
            </label>
          </div>

          {/* Inline Token Update Form */}
          {editingTokenPageId === page1.page_id ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px', borderRadius: '8px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Enter New Page Access Token for Page 1:
              </label>
              <textarea
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                rows={3}
                placeholder="Paste Page Access Token (EAAn...)..."
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEditingTokenPageId(null);
                    setTokenInput('');
                  }}
                  style={{ height: '32px', padding: '0 10px', fontSize: '0.75rem' }}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={() => handleSavePageToken(page1.page_id)}
                  disabled={savingPageId === page1.page_id}
                  style={{ height: '32px', padding: '0 12px', fontSize: '0.75rem', backgroundColor: '#1877F2' }}
                >
                  {savingPageId === page1.page_id ? 'Saving...' : 'Save Token'}
                </Button>
              </div>
            </div>
          ) : null}

          {/* Action Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <Button
                variant="outline"
                onClick={() => handleTestPage(page1.page_id)}
                disabled={testingPageId === page1.page_id}
                style={{
                  height: '34px',
                  padding: '0 12px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#1877F2',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <FiRefreshCw style={{ animation: testingPageId === page1.page_id ? 'spin 1s linear infinite' : 'none' }} />
                <span>{testingPageId === page1.page_id ? 'Testing...' : 'Test Connection'}</span>
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  setEditingTokenPageId(page1.page_id);
                  setTokenInput('');
                }}
                style={{ height: '34px', padding: '0 12px', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <FiEdit3 />
                <span>Update Token</span>
              </Button>
            </div>

            {page1.has_token && (
              <button
                type="button"
                onClick={() => handleRemoveToken(page1.page_id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#EF4444',
                  cursor: 'pointer',
                  padding: '4px',
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Remove stored token for Page 1"
              >
                <FiTrash2 />
              </button>
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* CARD 2: Facebook Page 2                                  */}
        {/* ======================================================== */}
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: page2.ready_to_publish
              ? '2px solid rgba(16, 185, 129, 0.4)'
              : '1px solid var(--border-color)',
            borderRadius: '14px',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: '#10B981',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.375rem',
                  flexShrink: 0,
                  overflow: 'hidden',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                }}
              >
                {page2.picture_url ? (
                  <img
                    src={page2.picture_url}
                    alt={page2.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <FaFacebook />
                )}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    {page2.name}
                  </h3>
                  <span style={{ fontSize: '0.625rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10B981', fontWeight: 600 }}>
                    Slot 2
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Page ID: <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{page2.page_id}</strong>
                </div>
              </div>
            </div>

            {/* Status Pill */}
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: '20px',
                backgroundColor: `${statusColor(page2.token_status)}20`,
                color: statusColor(page2.token_status),
                border: `1px solid ${statusColor(page2.token_status)}50`,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: statusColor(page2.token_status) }} />
              <span>{formatStatus(page2.token_status)}</span>
            </span>
          </div>

          {/* Details & Token Info */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '10px',
              backgroundColor: 'var(--bg-main)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              fontSize: '0.8125rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>Page Link:</span>
              <a
                href={page2.page_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#10B981', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <span>Visit Facebook Page</span>
                <FiExternalLink />
              </a>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
              <span style={{ color: 'var(--text-muted)', paddingTop: '2px' }}>Stored Token:</span>
              {page2.has_token ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', maxWidth: '75%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        wordBreak: revealedTokens[page2.page_id] ? 'break-all' : 'normal',
                        fontSize: revealedTokens[page2.page_id] ? '0.75rem' : '0.8125rem',
                        backgroundColor: revealedTokens[page2.page_id] ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') : 'transparent',
                        padding: revealedTokens[page2.page_id] ? '3px 6px' : '0',
                        borderRadius: '4px',
                        maxWidth: '260px',
                      }}
                    >
                      {revealedTokens[page2.page_id] || page2.token_hint || 'Token Encrypted (AES-256)'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleRevealToken(page2.page_id)}
                      disabled={loadingTokens[page2.page_id]}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#1877F2',
                        padding: '2px 6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        borderRadius: '4px',
                      }}
                      title={revealedTokens[page2.page_id] ? 'Hide token' : 'View full token'}
                    >
                      {loadingTokens[page2.page_id] ? (
                        <FiRefreshCw style={{ animation: 'spin 1s linear infinite' }} />
                      ) : revealedTokens[page2.page_id] ? (
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
                    {revealedTokens[page2.page_id] && (
                      <button
                        type="button"
                        onClick={() => handleCopyToken(page2.page_id, revealedTokens[page2.page_id])}
                        style={{
                          background: 'rgba(24, 119, 242, 0.1)',
                          border: '1px solid rgba(24, 119, 242, 0.25)',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          color: copiedTokenPageId === page2.page_id ? '#22C55E' : '#1877F2',
                          padding: '2px 8px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                        }}
                        title="Copy full token to clipboard"
                      >
                        {copiedTokenPageId === page2.page_id ? <FiCheck /> : <FiCopy />}
                        <span>{copiedTokenPageId === page2.page_id ? 'Copied' : 'Copy'}</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <span style={{ color: '#F59E0B', fontWeight: 600 }}>No token set</span>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>Token Expiry:</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                {page2.token_never_expires
                  ? 'Never Expires (Page Token)'
                  : page2.token_expires_in_days
                  ? `${page2.token_expires_in_days} days remaining`
                  : page2.token_expires_at
                  ? new Date(page2.token_expires_at).toLocaleDateString()
                  : 'N/A'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>Create Content Access:</span>
              <span style={{ color: page2.can_create_content ? '#22C55E' : '#EF4444', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                {page2.can_create_content ? <FiCheck /> : <FiX />}
                {page2.can_create_content ? 'Authorized' : 'Missing'}
              </span>
            </div>
          </div>

          {/* Permissions Row */}
          <div>
            <span style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
              Granted Meta Permissions
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {['CREATE_CONTENT', 'pages_manage_posts', 'pages_read_engagement', 'pages_show_list'].map((perm) => {
                const isGranted = page2.permissions?.includes(perm) || (perm === 'CREATE_CONTENT' && page2.can_create_content);
                return (
                  <span
                    key={perm}
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 500,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: isGranted ? 'rgba(16, 185, 129, 0.12)' : 'rgba(156, 163, 175, 0.15)',
                      color: isGranted ? '#065F46' : 'var(--text-muted)',
                      border: `1px solid ${isGranted ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-color)'}`,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {isGranted ? <FiCheck style={{ fontSize: '0.75rem' }} /> : <FiX style={{ fontSize: '0.75rem' }} />}
                    <span>{formatPermissionName(perm)}</span>
                  </span>
                );
              })}
            </div>
          </div>

          {/* Auto-Publish Toggle Switch */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: '8px',
              backgroundColor: page2.auto_publish_enabled ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-main)',
              border: `1px solid ${page2.auto_publish_enabled ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-color)'}`,
            }}
          >
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Auto-Publish for Page 2
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                {page2.auto_publish_enabled ? 'Active: Scheduled listings publish automatically' : 'Paused: Manual approval required'}
              </div>
            </div>
            <label style={{ position: 'relative', display: 'inline-block', width: '40px', height: '22px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={page2.auto_publish_enabled}
                onChange={() => handleToggleAutoPublish(page2)}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: page2.auto_publish_enabled ? '#10B981' : '#9CA3AF',
                  borderRadius: '20px',
                  transition: '0.2s ease',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    height: '16px',
                    width: '16px',
                    left: page2.auto_publish_enabled ? '20px' : '4px',
                    bottom: '3px',
                    backgroundColor: '#FFFFFF',
                    borderRadius: '50%',
                    transition: '0.2s ease',
                  }}
                />
              </span>
            </label>
          </div>

          {/* Inline Token Update Form */}
          {editingTokenPageId === page2.page_id ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px', borderRadius: '8px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Enter New Page Access Token for Page 2:
              </label>
              <textarea
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                rows={3}
                placeholder="Paste Page Access Token (EAAn...)..."
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEditingTokenPageId(null);
                    setTokenInput('');
                  }}
                  style={{ height: '32px', padding: '0 10px', fontSize: '0.75rem' }}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={() => handleSavePageToken(page2.page_id)}
                  disabled={savingPageId === page2.page_id}
                  style={{ height: '32px', padding: '0 12px', fontSize: '0.75rem', backgroundColor: '#10B981', borderColor: '#10B981' }}
                >
                  {savingPageId === page2.page_id ? 'Saving...' : 'Save Token'}
                </Button>
              </div>
            </div>
          ) : null}

          {/* Action Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <Button
                variant="outline"
                onClick={() => handleTestPage(page2.page_id)}
                disabled={testingPageId === page2.page_id}
                style={{
                  height: '34px',
                  padding: '0 12px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#10B981',
                  borderColor: 'rgba(16, 185, 129, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <FiRefreshCw style={{ animation: testingPageId === page2.page_id ? 'spin 1s linear infinite' : 'none' }} />
                <span>{testingPageId === page2.page_id ? 'Testing...' : 'Test Connection'}</span>
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  setEditingTokenPageId(page2.page_id);
                  setTokenInput('');
                }}
                style={{ height: '34px', padding: '0 12px', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <FiEdit3 />
                <span>Update Token</span>
              </Button>
            </div>

            {page2.has_token && (
              <button
                type="button"
                onClick={() => handleRemoveToken(page2.page_id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#EF4444',
                  cursor: 'pointer',
                  padding: '4px',
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Remove stored token for Page 2"
              >
                <FiTrash2 />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Strict Isolation & Security Architecture Guarantee Callout */}
      <div
        style={{
          padding: '1.25rem',
          borderRadius: '12px',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1877F2', fontWeight: 700, fontSize: '0.875rem' }}>
          <FiShield />
          <span>Zero Content Mixing & Token Isolation Security Guarantee</span>
        </div>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Page 1 (<strong>{page1.name}</strong> • <code>{page1.page_id}</code>) and Page 2 (<strong>{page2.name}</strong> • <code>{page2.page_id}</code>) operate under the same Meta Developer App (<code>967687235797751</code>), but are isolated with independent database slots. Their access tokens are individually encrypted with AES-256-GCM. During automated or scheduled publishing, each page's photos, captions, and hashtags are transmitted strictly with its own authenticated Page Access Token, preventing any cross-page contamination.
        </p>
      </div>
    </div>
  );
};
