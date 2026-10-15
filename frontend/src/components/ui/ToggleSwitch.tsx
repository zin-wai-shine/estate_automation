import React from 'react';
import { useTheme } from '../../context/ThemeContext';

export interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  tooltip?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  activeColor?: string;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  label,
  tooltip,
  disabled = false,
  size = 'sm',
  activeColor = '#2563EB',
}) => {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';

  const isSmall = size === 'sm';
  const trackWidth = isSmall ? 32 : 38;
  const trackHeight = isSmall ? 18 : 22;
  const knobSize = isSmall ? 14 : 18;
  const knobOffset = 2;
  const travelDistance = trackWidth - knobSize - knobOffset * 2;

  const trackBg = checked
    ? activeColor
    : isDark
    ? 'rgba(255, 255, 255, 0.16)'
    : 'rgba(0, 0, 0, 0.18)';

  return (
    <div
      data-tooltip={tooltip}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.45rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        userSelect: 'none',
      }}
      onClick={(e) => {
        if (!disabled) {
          e.stopPropagation();
          onChange(!checked);
        }
      }}
    >
      <div
        role="switch"
        aria-checked={checked}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (!disabled && (e.key === ' ' || e.key === 'Enter')) {
            e.preventDefault();
            onChange(!checked);
          }
        }}
        style={{
          position: 'relative',
          width: `${trackWidth}px`,
          height: `${trackHeight}px`,
          borderRadius: '999px',
          backgroundColor: trackBg,
          transition: 'background-color 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
          flexShrink: 0,
          outline: 'none',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: `${knobOffset}px`,
            left: `${knobOffset}px`,
            width: `${knobSize}px`,
            height: `${knobSize}px`,
            borderRadius: '50%',
            backgroundColor: '#FFFFFF',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.28)',
            transform: checked ? `translateX(${travelDistance}px)` : 'translateX(0)',
            transition: 'transform 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      </div>

      {label && (
        <span
          style={{
            fontSize: isSmall ? '0.75rem' : '0.8125rem',
            fontWeight: 500,
            color: checked ? (isDark ? '#FFFFFF' : 'var(--text-primary)') : 'var(--text-secondary)',
            whiteSpace: 'nowrap',
            transition: 'color 0.15s ease',
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
};
