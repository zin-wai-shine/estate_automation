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
  headerExtra?: React.ReactNode;
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
  headerExtra,
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
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex,
        padding: '1rem',
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
          width: '95%',
          maxWidth,
          height: height || undefined,
          maxHeight: height || '90vh',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: '0.75rem',
          boxShadow: 'var(--shadow-md)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          overscrollBehavior: 'contain',
          animation: 'fadeIn 0.15s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '0.875rem 1.25rem',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
            {typeof title === 'string' ? (
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                {title}
              </h3>
            ) : (
              title
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            {headerExtra}
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '1.125rem',
                cursor: 'pointer',
                display: 'inline-flex',
                padding: '0.25rem',
                borderRadius: '0.25rem',
              }}
            >
              <FiX />
            </button>
          </div>
        </div>

        {/* Body */}
        <div
          className="modal-scrollable-body"
          style={{
            padding: bodyPadding !== undefined ? bodyPadding : '1.25rem',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            flex: 1,
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
