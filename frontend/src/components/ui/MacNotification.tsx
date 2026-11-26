import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FiCheck, FiTrash2, FiCrosshair, FiX } from 'react-icons/fi';
import { useTheme } from '../../context/ThemeContext';

export type MacNotificationType = 'success' | 'danger' | 'info';

export interface MacNotificationPayload {
  title: string;
  message: string;
  type?: MacNotificationType;
  durationMs?: number;
}

interface MacNotificationItem extends MacNotificationPayload {
  id: string;
}

export function showMacNotification(payload: MacNotificationPayload | string, type: MacNotificationType = 'info') {
  if (typeof window === 'undefined') return;
  const detail: MacNotificationPayload =
    typeof payload === 'string'
      ? {
          title:
            type === 'danger'
              ? 'Error'
              : type === 'success'
                ? 'Success'
                : 'Notification',
          message: payload,
          type,
        }
      : payload;

  window.dispatchEvent(new CustomEvent('ea_show_mac_notification', { detail }));
}

export const MacNotificationHost: React.FC = () => {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  const [notification, setNotification] = useState<MacNotificationItem | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trigger = useCallback((detail: MacNotificationPayload) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    const id = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    setNotification({
      id,
      title: detail.title || 'Notification',
      message: detail.message || '',
      type: detail.type || 'success',
    });
    timerRef.current = setTimeout(() => {
      setNotification(null);
    }, detail.durationMs ?? 3800);
  }, []);

  useEffect(() => {
    const handleEvent = (e: Event) => {
      const custom = e as CustomEvent<MacNotificationPayload>;
      if (custom?.detail) {
        trigger(custom.detail);
      }
    };
    window.addEventListener('ea_show_mac_notification', handleEvent);
    return () => {
      window.removeEventListener('ea_show_mac_notification', handleEvent);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [trigger]);

  if (typeof document === 'undefined' || !notification) return null;

  const type = notification.type || 'success';

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: '22px',
        right: '24px',
        zIndex: 9999999,
        width: '350px',
        maxWidth: 'calc(100vw - 40px)',
        backgroundColor: isDark ? 'rgba(28, 33, 40, 0.86)' : 'rgba(255, 255, 255, 0.92)',
        backdropFilter: 'blur(28px) saturate(190%)',
        WebkitBackdropFilter: 'blur(28px) saturate(190%)',
        border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(0, 0, 0, 0.1)',
        borderRadius: '16px',
        boxShadow: isDark
          ? '0 20px 45px rgba(0, 0, 0, 0.5), 0 4px 14px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.12)'
          : '0 20px 45px rgba(0, 0, 0, 0.14), 0 4px 14px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.7)',
        padding: '13px 15px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        animation: 'macNotificationSlideIn 0.32s cubic-bezier(0.16, 1, 0.3, 1)',
        userSelect: 'none',
        cursor: 'default',
        overflow: 'visible',
      }}
    >
      <style>{`
        @keyframes macNotificationSlideIn {
          0% {
            opacity: 0;
            transform: translate3d(40px, -6px, 0) scale(0.95);
          }
          70% {
            opacity: 1;
            transform: translate3d(-2px, 0, 0) scale(1.008);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }
      `}</style>

      {/* Top-Left Corner Close Button (Half above border) */}
      <button
        type="button"
        onClick={() => setNotification(null)}
        style={{
          position: 'absolute',
          top: '-10px',
          left: '-10px',
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          backgroundColor: isDark ? '#21262D' : '#FFFFFF',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.22)' : '1px solid rgba(0, 0, 0, 0.14)',
          boxShadow: isDark ? '0 3px 10px rgba(0, 0, 0, 0.45)' : '0 3px 10px rgba(0, 0, 0, 0.14)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: isDark ? '#C9D1D9' : '#475569',
          cursor: 'pointer',
          padding: 0,
          zIndex: 2,
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = isDark ? '#30363D' : '#F1F5F9';
          e.currentTarget.style.color = isDark ? '#FFFFFF' : '#0F172A';
          e.currentTarget.style.transform = 'scale(1.06)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = isDark ? '#21262D' : '#FFFFFF';
          e.currentTarget.style.color = isDark ? '#C9D1D9' : '#475569';
          e.currentTarget.style.transform = 'scale(1)';
        }}
        aria-label="Dismiss notification"
      >
        <FiX size={13} strokeWidth={2.5} />
      </button>

      {/* Status Icon */}
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '9px',
          backgroundColor:
            type === 'danger'
              ? (isDark ? 'rgba(239, 68, 68, 0.16)' : 'rgba(239, 68, 68, 0.12)')
              : type === 'info'
                ? (isDark ? 'rgba(59, 130, 246, 0.16)' : 'rgba(59, 130, 246, 0.12)')
                : (isDark ? 'rgba(16, 185, 129, 0.16)' : 'rgba(16, 185, 129, 0.12)'),
          border:
            type === 'danger'
              ? (isDark ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(239, 68, 68, 0.25)')
              : type === 'info'
                ? (isDark ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid rgba(59, 130, 246, 0.25)')
                : (isDark ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(16, 185, 129, 0.25)'),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color:
            type === 'danger'
              ? '#EF4444'
              : type === 'info'
                ? '#3B82F6'
                : '#10B981',
          flexShrink: 0,
          marginTop: '1px',
        }}
      >
        {type === 'danger' ? (
          <FiTrash2 size={16} />
        ) : type === 'info' ? (
          <FiCrosshair size={16} />
        ) : (
          <FiCheck size={16} strokeWidth={2.5} />
        )}
      </div>

      {/* Notification Title & Body */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ fontSize: '0.84rem', fontWeight: 650, color: isDark ? '#F1F5F9' : '#0F172A', lineHeight: 1.3 }}>
            {notification.title}
          </div>
          <span style={{ fontSize: '0.68rem', color: isDark ? '#64748B' : '#94A3B8', flexShrink: 0 }}>
            now
          </span>
        </div>
        {notification.message && (
          <div style={{ fontSize: '0.75rem', color: isDark ? '#CBD5E1' : '#475569', lineHeight: 1.45, wordBreak: 'break-word' }}>
            {notification.message}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
