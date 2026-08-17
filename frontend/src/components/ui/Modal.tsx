import React, { useEffect } from 'react';
import { FiX } from 'react-icons/fi';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: string;
  closeOnOverlayClick?: boolean;
  zIndex?: number;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = '450px',
  closeOnOverlayClick = false,
  zIndex = 100000,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Only close on Escape if closeOnOverlayClick is enabled
        if (closeOnOverlayClick) onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, closeOnOverlayClick]);

  if (!isOpen) return null;

  return (
    <div
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
      }}
      onClick={closeOnOverlayClick ? onClose : undefined}
    >
      <div
        style={{
          width: '95%',
          maxWidth,
          maxHeight: '90vh',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: '0.75rem',
          boxShadow: 'var(--shadow-md)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'fadeIn 0.15s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {title}
          </h3>
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

        {/* Body */}
        <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1 }}>{children}</div>
      </div>
    </div>
  );
};
