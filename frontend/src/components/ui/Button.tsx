import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'danger-outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: React.CSSProperties;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'sm',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  style,
  ...props
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          bg: 'var(--accent-primary)',
          color: '#FFFFFF',
          border: '1px solid var(--accent-primary)',
          hoverBg: 'var(--accent-hover)',
        };
      case 'secondary':
        return {
          bg: 'var(--bg-surface-hover)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-color)',
          hoverBg: 'var(--border-color)',
        };
      case 'outline':
        return {
          bg: 'transparent',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-color)',
          hoverBg: 'var(--bg-surface-hover)',
        };
      case 'danger':
        return {
          bg: 'var(--status-danger)',
          color: '#FFFFFF',
          border: '1px solid var(--status-danger)',
          hoverBg: '#DC2626',
        };
      case 'danger-outline':
        return {
          bg: 'var(--status-danger-bg)',
          color: 'var(--status-danger)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          hoverBg: 'rgba(239, 68, 68, 0.2)',
        };
      case 'ghost':
        return {
          bg: 'transparent',
          color: 'var(--text-secondary)',
          border: '1px solid transparent',
          hoverBg: 'var(--bg-surface-hover)',
        };
      default:
        return {
          bg: 'var(--accent-primary)',
          color: '#FFFFFF',
          border: '1px solid var(--accent-primary)',
          hoverBg: 'var(--accent-hover)',
        };
    }
  };

  const vStyle = getVariantStyles();

  const padding = size === 'sm' ? '0.375rem 0.625rem' : size === 'lg' ? '0.625rem 1.25rem' : '0.5rem 0.875rem';
  const fontSize = size === 'sm' ? '0.75rem' : size === 'lg' ? '0.9375rem' : '0.8125rem';

  return (
    <button
      disabled={disabled || isLoading}
      style={{
        WebkitAppearance: 'none',
        MozAppearance: 'none',
        appearance: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 500,
        borderRadius: '0.375rem',
        padding,
        fontSize,
        backgroundColor: vStyle.bg,
        color: vStyle.color,
        border: vStyle.border,
        cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
        opacity: disabled || isLoading ? 0.6 : 1,
        transition: 'all 0.15s ease',
        lineHeight: 1.2,
        outline: 'none',
        boxSizing: 'border-box',
        ...style,
      }}
      {...props}
    >
      {isLoading ? (
        <span style={{ marginRight: '0.375rem', animation: 'spin 1s linear infinite' }}>⏳</span>
      ) : leftIcon ? (
        <span style={{ display: 'inline-flex', marginRight: '0.375rem', fontSize: '0.875rem' }}>{leftIcon}</span>
      ) : null}
      <span>{children}</span>
      {rightIcon && <span style={{ display: 'inline-flex', marginLeft: '0.375rem', fontSize: '0.875rem' }}>{rightIcon}</span>}
    </button>
  );
};
