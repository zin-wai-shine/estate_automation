import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  className = '',
  id,
  style,
  ...props
}, ref) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', width: '100%' }}>
      {label && (
        <label htmlFor={inputId} style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
          {label}
        </label>
      )}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
        {leftIcon && (
          <span style={{ position: 'absolute', left: '0.75rem', color: 'var(--text-muted)', display: 'inline-flex' }}>
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          style={{
            width: '100%',
            padding: leftIcon ? '0.5rem 0.75rem 0.5rem 2.25rem' : rightIcon ? '0.5rem 2.25rem 0.5rem 0.75rem' : '0.5rem 0.75rem',
            fontSize: '0.875rem',
            backgroundColor: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            border: error ? '1px solid var(--status-danger)' : '1px solid var(--border-color)',
            borderRadius: '0.375rem',
            outline: 'none',
            transition: 'border-color 0.15s ease',
            ...style,
          }}
          {...props}
        />
        {rightIcon && (
          <span style={{ position: 'absolute', right: '0.75rem', color: 'var(--text-muted)', display: 'inline-flex' }}>
            {rightIcon}
          </span>
        )}
      </div>
      {error && <span style={{ fontSize: '0.75rem', color: 'var(--status-danger)' }}>{error}</span>}
      {!error && helperText && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{helperText}</span>}
    </div>
  );
});

Input.displayName = 'Input';
