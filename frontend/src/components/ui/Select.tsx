import React from 'react';
import ReactSelect from 'react-select';
import type { StylesConfig } from 'react-select';

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
  height?: string;
  isSearchable?: boolean;
  isDisabled?: boolean;
  className?: string;
  id?: string;
}

export const Select: React.FC<SelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select option',
  width = '100%',
  height = '40px',
  isSearchable = false,
  isDisabled = false,
  className,
  id,
}) => {
  const selectedOption = options.find((opt) => String(opt.value) === String(value)) || null;

  const customStyles: StylesConfig<SelectOption, false> = {
    container: (provided) => ({
      ...provided,
      width,
    }),
    control: (provided, state) => ({
      ...provided,
      minHeight: height,
      height,
      backgroundColor: 'var(--bg-main)',
      borderColor: state.isFocused ? 'var(--accent-primary)' : 'var(--border-color)',
      borderRadius: '0.5rem',
      boxShadow: state.isFocused ? '0 0 0 1px var(--accent-primary)' : 'none',
      fontSize: '0.8125rem',
      color: 'var(--text-primary)',
      cursor: 'pointer',
      boxSizing: 'border-box',
      '&:hover': {
        borderColor: state.isFocused ? 'var(--accent-primary)' : 'var(--border-hover, #4B5563)',
      },
    }),
    valueContainer: (provided) => ({
      ...provided,
      height,
      padding: '0 0.75rem',
      display: 'flex',
      alignItems: 'center',
    }),
    singleValue: (provided) => ({
      ...provided,
      color: 'var(--text-primary)',
      fontSize: '0.8125rem',
      fontWeight: 500,
      margin: 0,
    }),
    placeholder: (provided) => ({
      ...provided,
      color: 'var(--text-muted)',
      fontSize: '0.8125rem',
      margin: 0,
    }),
    input: (provided) => ({
      ...provided,
      color: 'var(--text-primary)',
      fontSize: '0.8125rem',
      margin: 0,
      padding: 0,
    }),
    indicatorSeparator: () => ({
      display: 'none',
    }),
    dropdownIndicator: (provided, state) => ({
      ...provided,
      color: state.isFocused ? 'var(--accent-primary)' : 'var(--text-muted)',
      padding: '0 0.5rem',
      transition: 'transform 0.2s ease',
      transform: state.selectProps.menuIsOpen ? 'rotate(180deg)' : 'none',
      '&:hover': {
        color: 'var(--text-primary)',
      },
    }),
    menu: (provided) => ({
      ...provided,
      backgroundColor: 'var(--bg-surface)',
      border: '1px solid var(--border-color)',
      borderRadius: '0.5rem',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
      overflow: 'hidden',
      zIndex: 9999,
      marginTop: '4px',
    }),
    menuList: (provided) => ({
      ...provided,
      padding: '0.25rem',
      maxHeight: '240px',
    }),
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isSelected
        ? 'var(--accent-primary)'
        : state.isFocused
        ? 'var(--bg-surface-hover)'
        : 'transparent',
      color: state.isSelected ? '#ffffff' : 'var(--text-primary)',
      fontSize: '0.8125rem',
      fontWeight: state.isSelected ? 600 : 400,
      padding: '0.5rem 0.75rem',
      borderRadius: '0.375rem',
      cursor: 'pointer',
      margin: '0.125rem 0',
      transition: 'background-color 0.15s ease',
      '&:active': {
        backgroundColor: 'var(--accent-primary)',
      },
    }),
  };

  return (
    <ReactSelect<SelectOption, false>
      id={id}
      className={className}
      value={selectedOption}
      onChange={(opt) => {
        if (opt) onChange(opt.value);
      }}
      options={options}
      styles={customStyles}
      placeholder={placeholder}
      isSearchable={isSearchable}
      isDisabled={isDisabled}
    />
  );
};
