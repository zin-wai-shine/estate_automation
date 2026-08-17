import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'default', size = 'sm' }) => {
  const getColors = () => {
    switch (variant) {
      case 'success':
        return { bg: 'var(--status-success-bg)', color: 'var(--status-success)', border: 'none' };
      case 'warning':
        return { bg: 'var(--status-warning-bg)', color: 'var(--status-warning)', border: 'none' };
      case 'danger':
        return { bg: 'var(--status-danger-bg)', color: 'var(--status-danger)', border: 'none' };
      case 'info':
        return { bg: 'var(--status-info-bg)', color: 'var(--status-info)', border: 'none' };
      case 'outline':
        return { bg: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' };
      default:
        return { bg: 'var(--bg-surface-hover)', color: 'var(--text-secondary)', border: 'none' };
    }
  };

  const style = getColors();

  // Helper to convert ALL_CAPS string to Title Case (e.g. READY_FOR_REVIEW -> Ready for Review)
  const formatText = (text: React.ReactNode): React.ReactNode => {
    if (typeof text === 'string') {
      return text
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (l) => l.toUpperCase());
    }
    return text;
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: size === 'sm' ? '0.125rem 0.5rem' : '0.25rem 0.75rem',
        borderRadius: '9999px',
        fontSize: size === 'sm' ? '0.75rem' : '0.8125rem',
        fontWeight: 500,
        backgroundColor: style.bg,
        color: style.color,
        border: style.border,
        textTransform: 'none',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {formatText(children)}
    </span>
  );
};
