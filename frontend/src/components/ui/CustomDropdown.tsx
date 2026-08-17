import React, { useState, useRef, useEffect } from 'react';
import { FiChevronDown, FiCheck } from 'react-icons/fi';

export interface DropdownOption {
  value: string;
  label: string;
  badge?: string;
  icon?: React.ReactNode;
}

interface CustomDropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (val: string) => void;
  label?: string;
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({
  options,
  value,
  onChange,
  label,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', position: 'relative' }} ref={dropdownRef}>
      {label && (
        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.625rem 0.875rem',
          borderRadius: '0.5rem',
          backgroundColor: 'var(--bg-secondary)',
          border: isOpen ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
          color: 'var(--text-primary)',
          fontSize: '0.8125rem',
          fontWeight: 500,
          cursor: 'pointer',
          outline: 'none',
          boxShadow: isOpen ? '0 0 0 3px rgba(37, 99, 235, 0.2)' : 'none',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
          {selectedOption.icon && <span style={{ fontSize: '1rem' }}>{selectedOption.icon}</span>}
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {selectedOption.label}
          </span>
          {selectedOption.badge && (
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                padding: '0.125rem 0.375rem',
                borderRadius: '0.25rem',
                backgroundColor: 'var(--accent-primary-alpha)',
                color: 'var(--accent-primary)',
                flexShrink: 0,
              }}
            >
              {selectedOption.badge}
            </span>
          )}
        </div>

        <FiChevronDown
          style={{
            fontSize: '1rem',
            color: 'var(--text-muted)',
            transition: 'transform 0.2s ease',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            flexShrink: 0,
          }}
        />
      </button>

      {/* Dropdown Options Popover Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 0.375rem)',
            left: 0,
            right: 0,
            zIndex: 999,
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: '0.5rem',
            padding: '0.375rem',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.375rem',
                  border: 'none',
                  backgroundColor: isSelected ? 'var(--bg-surface-hover)' : 'transparent',
                  color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)',
                  fontSize: '0.8125rem',
                  fontWeight: isSelected ? 600 : 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {opt.icon && <span>{opt.icon}</span>}
                  <span>{opt.label}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {opt.badge && (
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        padding: '0.125rem 0.375rem',
                        borderRadius: '0.25rem',
                        backgroundColor: 'var(--bg-secondary)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {opt.badge}
                    </span>
                  )}
                  {isSelected && <FiCheck style={{ fontSize: '0.875rem', color: 'var(--accent-primary)' }} />}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
