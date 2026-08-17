import React, { useState, useRef, useEffect } from 'react';
import { FiChevronDown, FiCheck } from 'react-icons/fi';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  width?: string;
}

export const Select: React.FC<SelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select option',
  width = '180px',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

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
    <div ref={dropdownRef} style={{ position: 'relative', width, display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.4375rem 0.75rem',
          fontSize: '0.8125rem',
          fontWeight: 500,
          backgroundColor: 'var(--bg-surface)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: '0.375rem',
          cursor: 'pointer',
          outline: 'none',
          transition: 'all 0.12s ease',
        }}
      >
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <FiChevronDown
          style={{
            fontSize: '0.875rem',
            color: 'var(--text-muted)',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
            marginLeft: '0.375rem',
            flexShrink: 0,
          }}
        />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: '0.375rem',
            boxShadow: 'var(--shadow-md)',
            zIndex: 50,
            maxHeight: '220px',
            overflowY: 'auto',
            padding: '0.25rem',
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
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.375rem 0.625rem',
                  fontSize: '0.8125rem',
                  color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)',
                  backgroundColor: isSelected ? 'var(--bg-surface-hover)' : 'transparent',
                  border: 'none',
                  borderRadius: '0.25rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontWeight: isSelected ? 600 : 400,
                }}
              >
                <span>{opt.label}</span>
                {isSelected && <FiCheck style={{ fontSize: '0.75rem' }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
