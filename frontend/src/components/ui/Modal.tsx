import React, { useEffect, useRef } from 'react';
import { FiX } from 'react-icons/fi';
import { useScrollLock } from '../../hooks/useScrollLock';

export { useScrollLock };

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string;
  height?: string;
  bodyPadding?: string;
  closeOnOverlayClick?: boolean;
  zIndex?: number;
  headerCenter?: React.ReactNode;
  headerExtra?: React.ReactNode;
  hideHeader?: boolean;
  fullHeight?: boolean;
  transparentHeader?: boolean;
  headerStyle?: React.CSSProperties;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = '450px',
  height,
  bodyPadding,
  closeOnOverlayClick = false,
  zIndex = 100000,
  headerCenter,
  headerExtra,
  hideHeader = false,
  fullHeight = false,
  transparentHeader = false,
  headerStyle,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Universal scroll isolation: completely isolates background containers from wheel / touch overscroll
  useScrollLock(isOpen, { containerRef: overlayRef });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Only close on Escape if closeOnOverlayClick is enabled
        if (closeOnOverlayClick) onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, onClose, closeOnOverlayClick]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: fullHeight ? '#0D1117' : 'rgba(0, 0, 0, 0.65)',
        backdropFilter: fullHeight ? undefined : 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex,
        padding: fullHeight ? 0 : '1rem',
        overscrollBehavior: 'contain',
        touchAction: 'none',
      }}
      onWheel={(e) => {
        e.stopPropagation();
      }}
      onClick={closeOnOverlayClick ? onClose : undefined}
    >
      <div
        style={{
          width: fullHeight ? '100vw' : '95%',
          maxWidth: fullHeight ? '100vw' : maxWidth,
          height: fullHeight ? '100vh' : (height || undefined),
          maxHeight: fullHeight ? '100vh' : (height || '90vh'),
          backgroundColor: 'var(--bg-surface)',
          border: fullHeight ? 'none' : '1px solid var(--border-color)',
          borderRadius: fullHeight ? '0' : '0.75rem',
          boxShadow: fullHeight ? 'none' : 'var(--shadow-md)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overscrollBehavior: 'contain',
          animation: 'fadeIn 0.15s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {!hideHeader && (
          <div
            style={{
              padding: transparentHeader ? '0.75rem 1.25rem' : '0.875rem 1.25rem',
              borderBottom: transparentHeader ? 'none' : '1px solid var(--border-color)',
              backgroundColor: transparentHeader ? 'transparent' : undefined,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              position: transparentHeader ? 'absolute' : 'relative',
              top: transparentHeader ? 0 : undefined,
              left: transparentHeader ? 0 : undefined,
              right: transparentHeader ? 0 : undefined,
              zIndex: transparentHeader ? 50 : undefined,
              pointerEvents: transparentHeader ? 'none' : undefined,
              ...headerStyle,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0, pointerEvents: 'auto' }}>
              {typeof title === 'string' ? (
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  {title}
                </h3>
              ) : (
                title
              )}
            </div>
            {headerCenter && (
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  pointerEvents: 'auto',
                  zIndex: 2,
                }}
              >
                {headerCenter}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0, zIndex: 1, pointerEvents: 'auto' }}>
              {headerExtra}
              <button
                onClick={onClose}
                style={{
                  background: transparentHeader ? 'var(--bg-surface)' : 'transparent',
                  border: transparentHeader ? '1px solid var(--border-color)' : 'none',
                  color: 'var(--text-muted)',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: transparentHeader ? '32px' : 'auto',
                  height: transparentHeader ? '32px' : 'auto',
                  padding: transparentHeader ? 0 : '0.25rem',
                  borderRadius: transparentHeader ? '6px' : '0.25rem',
                  boxShadow: transparentHeader ? '0 1px 2px rgba(0, 0, 0, 0.04)' : 'none',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--text-primary)';
                  if (transparentHeader) {
                    e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)';
                    e.currentTarget.style.borderColor = 'var(--border-color-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-muted)';
                  if (transparentHeader) {
                    e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                  }
                }}
                title="Close"
              >
                <FiX />
              </button>
            </div>
          </div>
        )}

        {/* Body */}
        <div
          className="modal-scrollable-body"
          style={{
            padding: bodyPadding !== undefined ? bodyPadding : (fullHeight ? '0' : '1.25rem'),
            overflowY: fullHeight ? 'hidden' : 'auto',
            overscrollBehavior: 'contain',
            flex: 1,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}
          onWheel={(e) => {
            e.stopPropagation();
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};
