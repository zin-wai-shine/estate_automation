import React from 'react';

export interface SwitchToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  activeColor?: string;
  label?: string;
  disabled?: boolean;
  isDark?: boolean;
}

export const SwitchToggle: React.FC<SwitchToggleProps> = ({
  checked,
  onChange,
  activeColor = 'var(--accent-primary)',
  label,
  disabled = false,
  isDark = false,
}) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onChange(!checked);
      }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        background: 'none',
        border: 'none',
        padding: '2px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        userSelect: 'none',
      }}
    >
      {label && (
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: checked ? activeColor : 'var(--text-muted)',
            transition: 'color 0.2s ease',
          }}
        >
          {label}
        </span>
      )}
      <div
        style={{
          width: '38px',
          height: '22px',
          borderRadius: '9999px',
          backgroundColor: checked ? activeColor : (isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.18)'),
          position: 'relative',
          transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: checked ? `0 2px 8px ${activeColor}55` : 'inset 0 1px 2px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div
          style={{
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            backgroundColor: '#FFFFFF',
            position: 'absolute',
            top: '2px',
            left: '2px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.28)',
            transform: checked ? 'translateX(16px)' : 'translateX(0px)',
            transition: 'transform 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </div>
    </button>
  );
};
