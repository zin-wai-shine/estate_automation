import React, { useEffect, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { FiRefreshCw, FiExternalLink, FiGlobe, FiAlertCircle } from 'react-icons/fi';

interface LiveBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LiveBrowserModal: React.FC<LiveBrowserModalProps> = ({ isOpen, onClose }) => {
  const [screenshotUrl, setScreenshotUrl] = useState<string>('');
  const [pageUrl, setPageUrl] = useState<string>('http://localhost:9223');
  const [pageTitle, setPageTitle] = useState<string>('Playwright Chromium Viewport');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const fetchLiveScreenshot = async () => {
    try {
      const resp = await fetch('http://localhost:8085/api/testing/live-browser');
      if (!resp.ok) {
        setErrorMsg('Live browser stream offline');
        setIsLoading(false);
        return;
      }
      const data = await resp.json();
      if (data.success && data.screenshot) {
        setScreenshotUrl(data.screenshot);
        if (data.current_url) setPageUrl(data.current_url);
        if (data.title) setPageTitle(data.title);
        setErrorMsg('');
      } else {
        setErrorMsg(data.error || 'No active browser page rendering');
      }
    } catch (e) {
      setErrorMsg('Failed to connect to browser worker on port 9223');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    fetchLiveScreenshot();

    const interval = setInterval(fetchLiveScreenshot, 1200);
    return () => clearInterval(interval);
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Live OpenClaw Viewport - ${pageTitle}`} maxWidth="860px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* URL Bar Navigation Indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.625rem 0.875rem',
            borderRadius: '0.5rem',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
            <FiGlobe style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
            <span
              style={{
                fontSize: '0.75rem',
                fontFamily: 'monospace',
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {pageUrl}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<FiRefreshCw style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />}
              onClick={fetchLiveScreenshot}
              style={{ fontSize: '0.6875rem', padding: '0 0.5rem', height: '26px' }}
            >
              Refresh
            </Button>
            {pageUrl.startsWith('http') && (
              <a
                href={pageUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  color: 'var(--accent-primary)',
                  textDecoration: 'none',
                }}
              >
                Open <FiExternalLink />
              </a>
            )}
          </div>
        </div>

        {/* Viewport Render Canvas */}
        <div
          style={{
            width: '100%',
            height: '460px',
            borderRadius: '0.5rem',
            backgroundColor: '#0D0E11',
            border: '1px solid var(--border-color)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {screenshotUrl ? (
            <img
              src={screenshotUrl}
              alt="Live Playwright Viewport"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
              <FiAlertCircle style={{ fontSize: '2rem', color: '#F59E0B' }} />
              <span style={{ fontSize: '0.8125rem' }}>{errorMsg || 'Connecting to live Chromium stream...'}</span>
            </div>
          )}

          <div
            style={{
              position: 'absolute',
              bottom: '8px',
              left: '8px',
              backgroundColor: 'rgba(0,0,0,0.75)',
              color: '#10B981',
              fontSize: '0.625rem',
              fontWeight: 700,
              padding: '0.15rem 0.4rem',
              borderRadius: '0.25rem',
            }}
          >
            ● LIVE OPENCLAW STREAM (1280x800)
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
          <Button variant="primary" size="sm" onClick={onClose}>
            Close Preview
          </Button>
        </div>
      </div>
    </Modal>
  );
};
