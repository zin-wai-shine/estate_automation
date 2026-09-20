import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Badge } from './Badge';
import {
  FiMonitor,
  FiCheckCircle,
  FiLoader,
  FiMinus,
  FiRefreshCw,
  FiLock,
} from 'react-icons/fi';

interface BrowserPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionConnected?: () => void;
}

export const BrowserPreviewModal: React.FC<BrowserPreviewModalProps> = ({
  isOpen,
  onClose,
  onSessionConnected = () => {},
}) => {
  const [step, setStep] = useState(1);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setStep(1);
    setIsConnected(false);

    // First trigger browser-worker to launch Chromium
    fetch('http://localhost:8085/api/social/facebook/browser/connect', { method: 'POST' }).catch(() => {});

    const t1 = setTimeout(() => setStep(2), 600);
    const t2 = setTimeout(() => setStep(3), 1200);

    // Poll backend GET /api/social/facebook/browser/status to check real authentication status
    const interval = setInterval(async () => {
      try {
        const res = await fetch('http://localhost:8085/api/social/facebook/browser/status');
        const data = await res.json();
        if (data.is_connected) {
          setIsConnected(true);
          setStep(4);
          setTimeout(() => {
            setStep(5);
            onSessionConnected();
          }, 800);
          clearInterval(interval);
        }
      } catch (e) {}
    }, 1500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearInterval(interval);
    };
  }, [isOpen]);

  if (isMinimized) {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '0.5rem',
          padding: '0.75rem 1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
          zIndex: 9999,
        }}
      >
        <FiMonitor style={{ color: 'var(--accent-primary)', fontSize: '1.125rem' }} />
        <div>
          <h5 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Facebook Browser Session (Active)
          </h5>
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Background Worker Running</span>
        </div>
        <Button variant="outline" size="sm" onClick={() => setIsMinimized(false)}>
          Restore Preview
        </Button>
      </div>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Facebook Chromium Browser" maxWidth="960px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {/* Live Viewport Stream Box */}
        <div
          style={{
            height: '520px',
            backgroundColor: '#0D0D0D',
            borderRadius: '0.5rem',
            border: '1px solid var(--border-color)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Browser Top Navigation Bar Header */}
          <div
            style={{
              height: '34px',
              backgroundColor: '#1A1A1A',
              borderBottom: '1px solid #262626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#EF4444' }} />
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#F59E0B' }} />
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10B981' }} />
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                backgroundColor: '#262626',
                padding: '0.125rem 0.625rem',
                borderRadius: '0.25rem',
                fontSize: '0.6875rem',
                color: '#A3A3A3',
              }}
            >
              <FiLock style={{ color: '#10B981', fontSize: '0.75rem' }} />
              <span>https://www.facebook.com/login (Live Browser Stream)</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {isConnected ? (
                <Badge variant="success" size="sm">Connected</Badge>
              ) : (
                <Badge variant="warning" size="sm">Awaiting Login</Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open('http://localhost:6080/vnc.html?autoconnect=true&resize=scale', '_blank')}
                style={{ fontSize: '0.6875rem', padding: '0.2rem 0.5rem', height: '24px' }}
              >
                Pop Out Window
              </Button>
            </div>
          </div>

          {/* Real Interactive Chromium Browser Stream via noVNC */}
          {isConnected ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1rem',
                padding: '2rem',
                backgroundColor: '#0D0D0D',
              }}
            >
              <FiCheckCircle style={{ color: '#10B981', fontSize: '2.5rem' }} />
              <p style={{ color: '#10B981', fontSize: '0.9375rem', fontWeight: 600, textAlign: 'center' }}>
                Facebook Connected! Session saved.
              </p>
            </div>
          ) : (
            <div style={{ flex: 1, position: 'relative', width: '100%', height: '100%', backgroundColor: '#000' }}>
              <iframe
                src="http://localhost:6080/vnc.html?autoconnect=true&resize=scale"
                style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                title="Live Facebook Browser"
                allow="clipboard-read; clipboard-write"
              />
            </div>
          )}
        </div>

        {/* Compact Status Timeline Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {[
            { id: 1, text: 'Opening Playwright / Chromium Isolated Worker...' },
            { id: 2, text: 'Opening https://www.facebook.com/login in live browser...' },
            { id: 3, text: 'Awaiting user login & 2FA inside live viewport...' },
            { id: 4, text: 'Saving persistent session profile to /data/browser-profiles...' },
            { id: 5, text: 'Facebook Connected! Durable session active across server restarts.' },
          ].map((s) => {
            const isDone = step > s.id;
            const isCurrent = step === s.id;

            return (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.625rem',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.375rem',
                  backgroundColor: isCurrent ? 'var(--bg-surface-hover)' : 'var(--bg-secondary)',
                  border: isCurrent ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                  fontSize: '0.75rem',
                }}
              >
                {isDone ? (
                  <FiCheckCircle style={{ color: 'var(--status-success)', fontSize: '1rem', flexShrink: 0 }} />
                ) : isCurrent ? (
                  <FiLoader style={{ color: 'var(--accent-primary)', fontSize: '1rem', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid var(--border-color)', flexShrink: 0 }} />
                )}

                <span style={{ color: isDone ? 'var(--status-success)' : isCurrent ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  {s.text}
                </span>
              </div>
            );
          })}
        </div>

        {/* Modal Action Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
          <Button variant="outline" size="sm" leftIcon={<FiMinus />} onClick={() => setIsMinimized(true)}>
            Hide Preview
          </Button>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<FiRefreshCw />}
              onClick={async () => {
                try {
                  await fetch('http://localhost:8085/api/social/facebook/browser/reconnect', { method: 'POST' });
                  setStep(1);
                  setTimeout(() => setStep(5), 1500);
                } catch (e) {}
              }}
            >
              Reconnect
            </Button>
            <Button
              variant="outline"
              size="sm"
              style={{ color: '#EF4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
              onClick={async () => {
                try {
                  await fetch('http://localhost:8085/api/social/facebook/browser/disconnect', { method: 'POST' });
                  setIsConnected(false);
                  setStep(1);
                } catch (e) {}
                onClose();
              }}
            >
              Disconnect
            </Button>
            <Button variant="primary" size="sm" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
