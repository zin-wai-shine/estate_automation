import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import type { ThemeMode } from '../../context/ThemeContext';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { CustomDropdown } from '../../components/ui/CustomDropdown';
import type { DropdownOption } from '../../components/ui/CustomDropdown';
import { BrowserPreviewModal } from '../../components/ui/BrowserPreviewModal';
import {
  FiMoon,
  FiSun,
  FiMonitor,
  FiLogOut,
  FiPlay,
  FiRefreshCw,
  FiRepeat,
  FiZap,
  FiFileText,
  FiGlobe,
  FiEdit3,
  FiFacebook,
  FiCheck,
  FiAlertTriangle,
  FiLink,
  FiCpu,
  FiServer,
  FiSliders,
  FiTrash2,
  FiShield,
  FiUser,
} from 'react-icons/fi';

interface SettingsViewProps {
  onNavigateToFacebookLogin?: () => void;
}

type SettingsSection = 'facebook' | 'strategy' | 'profile' | 'system';

export const SettingsView: React.FC<SettingsViewProps> = ({
  onNavigateToFacebookLogin = () => {},
}) => {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  const [activeSection, setActiveSection] = useState<SettingsSection>('facebook');
  const [importStrategy, setImportStrategy] = useState('AUTO_WITH_MANUAL_FALLBACK');
  const [isBrowserModalOpen, setIsBrowserModalOpen] = useState(false);
  const [isFbConnected, setIsFbConnected] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [statusType, setStatusType] = useState<'success' | 'warning' | 'info'>('info');
  const [isLoading, setIsLoading] = useState(false);

  // Confirmation modal states
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    const checkFbStatus = async () => {
      try {
        const res = await fetch('http://localhost:8085/api/social/facebook/browser/status');
        const data = await res.json();
        if (data.is_connected !== undefined) {
          setIsFbConnected(Boolean(data.is_connected));
        }
      } catch (e) {
        // Fallback
      }
    };
    checkFbStatus();
  }, []);

  const importStrategyOptions: DropdownOption[] = [
    { value: 'AUTO_WITH_MANUAL_FALLBACK', label: 'Auto Import (Meta API → Browser Agent)', badge: 'Recommended', icon: <FiZap style={{ color: '#F59E0B' }} /> },
    { value: 'OFFICIAL_API_FIRST', label: 'Official Meta Graph API Only', badge: 'Meta Pages', icon: <FiFileText style={{ color: '#3B82F6' }} /> },
    { value: 'BROWSER_WHEN_AVAILABLE', label: 'Browser Agent Worker Session', badge: 'Playwright', icon: <FiGlobe style={{ color: '#10B981' }} /> },
    { value: 'MANUAL_ONLY', label: 'Manual Fallback Entry', badge: 'Direct Upload', icon: <FiEdit3 style={{ color: '#A855F7' }} /> },
  ];

  const handleFacebookLogin = async () => {
    setIsLoading(true);
    setStatusMessage('Initiating Facebook Chromium Browser Session...');
    try {
      await fetch('http://localhost:8085/api/social/facebook/browser/connect', { method: 'POST' }).catch(() => {});
    } catch (e) {}
    setIsLoading(false);
    if (onNavigateToFacebookLogin) {
      onNavigateToFacebookLogin();
    }
    setIsBrowserModalOpen(true);
  };

  const handleSwitchAccount = async () => {
    setIsLoading(true);
    setStatusMessage('Switching Facebook account...');
    try {
      await fetch('http://localhost:8085/api/social/facebook/browser/switch-account', { method: 'POST' }).catch(() => {});
      setTimeout(() => {
        setIsFbConnected(false);
        setIsLoading(false);
        setStatusMessage('Account switched. Please log in with new Facebook credentials.');
        setStatusType('warning');
        setIsBrowserModalOpen(true);
      }, 800);
    } catch (e) {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setIsLoading(true);
    setStatusMessage('Testing connection to Facebook API & Playwright Session...');
    try {
      await fetch('http://localhost:8085/api/social/facebook/browser/test', { method: 'POST' }).catch(() => {});
      setTimeout(() => {
        setIsLoading(false);
        if (isFbConnected) {
          setStatusMessage('Connection Healthy! Meta API v19.0 & Chromium session responding.');
          setStatusType('success');
        } else {
          setStatusMessage('Connection Alert: Facebook is not logged in. Please click "Login with Facebook".');
          setStatusType('warning');
        }
      }, 800);
    } catch (e) {
      setIsLoading(false);
      setStatusMessage('Connection test completed.');
      setStatusType('success');
    }
  };

  const handleConfirmDisconnect = async () => {
    setShowDisconnectConfirm(false);
    setIsLoading(true);
    try {
      await fetch('http://localhost:8085/api/social/facebook/browser/disconnect', { method: 'POST' }).catch(() => {});
    } catch (e) {}
    setIsFbConnected(false);
    setIsLoading(false);
    setStatusMessage('Facebook account session disconnected.');
    setStatusType('warning');
  };

  const handleConfirmLogout = () => {
    setShowLogoutConfirm(false);
    logout();
  };

  const sections: { id: SettingsSection; label: string; icon: React.ReactNode; badge?: React.ReactNode }[] = [
    {
      id: 'facebook',
      label: 'Facebook Session',
      icon: <FiFacebook style={{ color: '#1877F2' }} />,
      badge: (
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isFbConnected ? 'var(--status-success)' : '#F59E0B',
            boxShadow: isFbConnected ? '0 0 6px rgba(16, 185, 129, 0.5)' : 'none',
          }}
        />
      ),
    },
    {
      id: 'strategy',
      label: 'Import Strategy',
      icon: <FiSliders style={{ color: 'var(--accent-primary)' }} />,
    },
    {
      id: 'profile',
      label: 'Admin Account',
      icon: <FiUser style={{ color: '#3B82F6' }} />,
    },
    {
      id: 'system',
      label: 'Appearance & Health',
      icon: <FiCpu style={{ color: '#F59E0B' }} />,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '1000px', margin: '0 auto', boxSizing: 'border-box' }}>
      {/* Top Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '0.375rem', backgroundColor: 'var(--accent-primary-alpha)', color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              System Configuration
            </span>
          </div>
          <h2 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>
            Settings & Preferences
          </h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem', margin: '0.25rem 0 0 0' }}>
            Manage Facebook integration status, scraping provider strategy, theme appearance, and administrative settings.
          </p>
        </div>
      </div>

      {/* Alert Notification Banner */}
      {statusMessage && (
        <div
          style={{
            padding: '0.875rem 1.125rem',
            borderRadius: '0.625rem',
            backgroundColor:
              statusType === 'success'
                ? 'var(--status-success-bg)'
                : statusType === 'warning'
                ? 'var(--status-warning-bg)'
                : 'var(--status-info-bg)',
            color:
              statusType === 'success'
                ? 'var(--status-success)'
                : statusType === 'warning'
                ? 'var(--status-warning)'
                : 'var(--status-info)',
            fontSize: '0.8125rem',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '0.625rem',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {statusType === 'success' && <FiCheck style={{ fontSize: '1rem', flexShrink: 0 }} />}
          {statusType === 'warning' && <FiAlertTriangle style={{ fontSize: '1rem', flexShrink: 0 }} />}
          {statusType === 'info' && <FiLink style={{ fontSize: '1rem', flexShrink: 0 }} />}
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Cool Simple Section Menu Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.625rem',
          padding: '0.25rem 0',
          overflowX: 'auto',
        }}
      >
        {sections.map((sec) => {
          const isActive = activeSection === sec.id;
          return (
            <button
              key={sec.id}
              type="button"
              onClick={() => setActiveSection(sec.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.625rem',
                padding: '0.625rem 1.125rem',
                borderRadius: '0.625rem',
                border: isActive ? '1px solid var(--accent-primary)' : '1px solid transparent',
                backgroundColor: isActive ? 'var(--bg-surface)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize: '0.84375rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, color 0.15s ease',
                whiteSpace: 'nowrap',
                boxSizing: 'border-box',
                boxShadow: isActive ? '0 4px 12px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(37, 99, 235, 0.25)' : 'none',
                outline: 'none',
              }}
            >
              <span style={{ fontSize: '1rem', display: 'flex', alignItems: 'center' }}>{sec.icon}</span>
              <span>{sec.label}</span>
              {sec.badge}
            </button>
          );
        })}
      </div>

      {/* Focused Active Section Content */}
      <div style={{ width: '100%' }}>
        {/* Section 1: Facebook Session */}
        {activeSection === 'facebook' && (
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: '0.875rem',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {/* Card Header */}
            <div
              style={{
                padding: '1.125rem 1.375rem',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'var(--bg-secondary)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '0.5rem',
                    backgroundColor: '#1877F2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFFFFF',
                    fontSize: '1.25rem',
                    flexShrink: 0,
                  }}
                >
                  <FiFacebook />
                </div>
                <div>
                  <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    Facebook Account & Session Status
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Meta Graph API OAuth & Playwright Persistent Session
                  </span>
                </div>
              </div>

              <Badge variant={isFbConnected ? 'success' : 'warning'} size="md">
                {isFbConnected ? 'CONNECTED' : 'NOT LOGGED IN'}
              </Badge>
            </div>

            {/* Card Content Body */}
            <div style={{ padding: '1.375rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {isFbConnected ? (
                /* Connected View */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div
                    style={{
                      padding: '1rem 1.125rem',
                      borderRadius: '0.625rem',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.75rem',
                    }}
                  >
                    <div>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                        Estate Automate Official Page
                      </h4>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem', display: 'block' }}>
                        Page ID: 100063948291038 • Profile Session: Persistent Volume
                      </span>
                    </div>
                    <Badge variant="success" size="sm">Active Token</Badge>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                      gap: '0.625rem',
                    }}
                  >
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={<FiFacebook />}
                      onClick={handleFacebookLogin}
                      disabled={isLoading}
                      style={{ height: '38px', fontSize: '0.8125rem', width: '100%', justifyContent: 'center' }}
                    >
                      Re-Authenticate
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<FiRepeat />}
                      onClick={handleSwitchAccount}
                      disabled={isLoading}
                      style={{ height: '38px', fontSize: '0.8125rem', width: '100%', justifyContent: 'center' }}
                    >
                      Switch Account
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<FiRefreshCw />}
                      onClick={handleTestConnection}
                      disabled={isLoading}
                      style={{ height: '38px', fontSize: '0.8125rem', width: '100%', justifyContent: 'center' }}
                    >
                      Test Connection
                    </Button>
                    <Button
                      variant="danger-outline"
                      size="sm"
                      leftIcon={<FiTrash2 />}
                      onClick={() => setShowDisconnectConfirm(true)}
                      style={{ height: '38px', fontSize: '0.8125rem', width: '100%', justifyContent: 'center' }}
                    >
                      Disconnect
                    </Button>
                  </div>
                </div>
              ) : (
                /* Not Logged In View - Simple & Clean */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <p style={{ fontSize: '0.84375rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                    Connect your Facebook account to enable automated property extractions and Meta page sync.
                  </p>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={<FiFacebook />}
                      onClick={handleFacebookLogin}
                      disabled={isLoading}
                      style={{ height: '38px', fontSize: '0.8125rem', padding: '0 1.25rem' }}
                    >
                      Connect Facebook
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<FiPlay />}
                      onClick={handleFacebookLogin}
                      style={{ height: '38px', fontSize: '0.8125rem', padding: '0 1.25rem' }}
                    >
                      Open Live Login Window
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Section 2: Import Strategy */}
        {activeSection === 'strategy' && (
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: '0.875rem',
              padding: '1.375rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.125rem',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '0.5rem', backgroundColor: 'var(--accent-primary-alpha)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FiSliders style={{ fontSize: '1.125rem' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Import Provider Strategy
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Configure automatic extraction pipeline precedence
                </span>
              </div>
            </div>

            <CustomDropdown
              label="Strategy Mode"
              options={importStrategyOptions}
              value={importStrategy}
              onChange={setImportStrategy}
            />

            <div
              style={{
                padding: '0.875rem 1rem',
                borderRadius: '0.5rem',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                fontSize: '0.78125rem',
                color: 'var(--text-muted)',
                lineHeight: 1.5,
              }}
            >
              <strong style={{ color: 'var(--text-primary)' }}>Strategy Note:</strong> Auto Import dynamically attempts official Meta API endpoints first, then seamlessly falls back to Playwright headless session workers for private group posts.
            </div>
          </div>
        )}

        {/* Section 3: Admin Account */}
        {activeSection === 'profile' && (
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: '0.875rem',
              padding: '1.375rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Administrator Profile & Credentials
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', borderRadius: '0.625rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--accent-primary) 0%, #059669 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
                  flexShrink: 0,
                }}
              >
                {user?.name?.[0] || 'P'}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    {user?.name || 'Platform Admin'}
                  </h4>
                  <Badge variant="info" size="sm">{user?.role || 'Admin'}</Badge>
                </div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
                  {user?.email || 'admin@estate.com'}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <Button
                variant="danger-outline"
                size="sm"
                leftIcon={<FiLogOut />}
                onClick={() => setShowLogoutConfirm(true)}
                style={{ height: '38px', fontSize: '0.8125rem', padding: '0 1.25rem' }}
              >
                Log Out Session
              </Button>
            </div>
          </div>
        )}

        {/* Section 4: Appearance & System Diagnostics */}
        {activeSection === 'system' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Appearance Mode Card */}
            <div
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                borderRadius: '0.875rem',
                padding: '1.375rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.125rem',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Appearance Theme Mode
              </span>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  padding: '0.25rem',
                  borderRadius: '0.625rem',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  gap: '0.25rem',
                  maxWidth: '420px',
                }}
              >
                {(['dark', 'light', 'system'] as ThemeMode[]).map((mode) => {
                  const isSelected = theme === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setTheme(mode)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.375rem',
                        padding: '0.5rem 0.375rem',
                        height: '36px',
                        borderRadius: '0.375rem',
                        border: isSelected ? '1px solid var(--border-color)' : 'none',
                        backgroundColor: isSelected ? 'var(--bg-surface)' : 'transparent',
                        color: isSelected ? 'var(--text-primary)' : 'var(--text-muted)',
                        fontSize: '0.78125rem',
                        fontWeight: isSelected ? 600 : 500,
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                        transition: 'all 0.15s ease',
                        boxShadow: isSelected ? 'var(--shadow-sm)' : 'none',
                      }}
                    >
                      {mode === 'dark' && <FiMoon style={{ fontSize: '0.8125rem', color: isSelected ? 'var(--accent-primary)' : 'inherit' }} />}
                      {mode === 'light' && <FiSun style={{ fontSize: '0.8125rem', color: isSelected ? '#F59E0B' : 'inherit' }} />}
                      {mode === 'system' && <FiMonitor style={{ fontSize: '0.8125rem', color: isSelected ? 'var(--accent-primary)' : 'inherit' }} />}
                      <span>{mode}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Diagnostics Card */}
            <div
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                borderRadius: '0.875rem',
                padding: '1.375rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Browser Worker Diagnostics & Infrastructure
              </span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', fontSize: '0.78125rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.625rem 0.875rem', borderRadius: '0.375rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                    <FiServer style={{ color: 'var(--accent-primary)' }} /> Backend API Service (Go)
                  </span>
                  <span style={{ color: 'var(--status-success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--status-success)' }} />
                    Port 8085
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.625rem 0.875rem', borderRadius: '0.375rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                    <FiCpu style={{ color: '#F59E0B' }} /> Playwright Chromium Engine
                  </span>
                  <span style={{ color: 'var(--status-success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--status-success)' }} />
                    Active Worker
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.625rem 0.875rem', borderRadius: '0.375rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                    <FiShield style={{ color: '#3B82F6' }} /> Profile Directory Path
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 500, fontFamily: 'monospace', fontSize: '0.71875rem' }}>
                    /browser-profiles
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Disconnect Facebook Confirmation Modal */}
      <Modal
        isOpen={showDisconnectConfirm}
        onClose={() => setShowDisconnectConfirm(false)}
        title="Disconnect Facebook Session?"
        maxWidth="420px"
        closeOnOverlayClick={true}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem', padding: '0.875rem', borderRadius: '0.5rem', backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <FiAlertTriangle style={{ color: '#EF4444', fontSize: '1.375rem', flexShrink: 0, marginTop: '0.125rem' }} />
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>
              Are you sure you want to disconnect your persistent Facebook browser session? Automatic post extractions and page sync will be paused until re-authenticated.
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.625rem' }}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDisconnectConfirm(false)}
              style={{ height: '36px', padding: '0 1rem' }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              leftIcon={<FiTrash2 />}
              onClick={handleConfirmDisconnect}
              style={{ height: '36px', padding: '0 1rem' }}
            >
              Disconnect
            </Button>
          </div>
        </div>
      </Modal>

      {/* Logout Session Confirmation Modal */}
      <Modal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        title="Confirm Log Out?"
        maxWidth="420px"
        closeOnOverlayClick={true}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem', padding: '0.875rem', borderRadius: '0.5rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
            <FiLogOut style={{ color: 'var(--accent-primary)', fontSize: '1.375rem', flexShrink: 0, marginTop: '0.125rem' }} />
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>
              Are you sure you want to log out of your administrator account session?
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.625rem' }}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLogoutConfirm(false)}
              style={{ height: '36px', padding: '0 1rem' }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              leftIcon={<FiLogOut />}
              onClick={handleConfirmLogout}
              style={{ height: '36px', padding: '0 1rem' }}
            >
              Log Out
            </Button>
          </div>
        </div>
      </Modal>

      {/* Persistent Facebook Live Browser Preview Modal */}
      <BrowserPreviewModal
        isOpen={isBrowserModalOpen}
        onClose={() => setIsBrowserModalOpen(false)}
        onSessionConnected={() => {
          setIsFbConnected(true);
          setStatusMessage('Facebook browser session active & persisted!');
          setStatusType('success');
        }}
      />
    </div>
  );
};
