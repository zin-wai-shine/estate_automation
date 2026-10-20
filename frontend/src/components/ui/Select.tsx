import React from 'react';
import ReactSelect, { components, type DropdownIndicatorProps, type SingleValueProps } from 'react-select';
import type { StylesConfig } from 'react-select';
import { FiChevronDown } from 'react-icons/fi';

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

const CustomDropdownIndicator: React.FC<DropdownIndicatorProps<SelectOption, false>> = (props) => {
  return (
    <components.DropdownIndicator {...props}>
      <FiChevronDown
        size={13}
        strokeWidth={1.75}
        style={{
          color: props.isFocused ? 'var(--accent-primary, #3B82F6)' : 'var(--text-muted, #94A3B8)',
          transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), color 0.15s ease',
          transform: props.selectProps.menuIsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          flexShrink: 0,
        }}
      />
    </components.DropdownIndicator>
  );
};

const CustomSingleValue: React.FC<SingleValueProps<SelectOption, false>> = ({ children, ...props }) => {
  return (
    <components.SingleValue {...props}>
      <span
        style={{
          display: 'block',
          width: '100%',
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {children}
      </span>
    </components.SingleValue>
  );
};

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
      borderRadius: '0.375rem',
      boxShadow: state.isFocused ? '0 0 0 1px var(--accent-primary)' : 'none',
      fontSize: '0.8125rem',
      color: 'var(--text-primary)',
      cursor: 'pointer',
      boxSizing: 'border-box',
      display: 'flex',
      alignItems: 'center',
      overflow: 'hidden',
      '&:hover': {
        borderColor: state.isFocused ? 'var(--accent-primary)' : 'var(--border-hover, #4B5563)',
      },
    }),
    valueContainer: (provided) => ({
      ...provided,
      height: '100%',
      padding: '0 0.25rem 0 0.625rem',
      display: 'flex',
      alignItems: 'center',
      overflow: 'hidden',
      flexWrap: 'nowrap',
      minWidth: 0,
      flex: 1,
    }),
    singleValue: (provided) => ({
      ...provided,
      color: 'var(--text-primary)',
      fontSize: '0.8125rem',
      fontWeight: 500,
      margin: 0,
      display: 'block',
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      lineHeight: 'normal',
    }),
    placeholder: (provided) => ({
      ...provided,
      color: 'var(--text-muted)',
      fontSize: '0.8125rem',
      margin: 0,
      display: 'block',
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      lineHeight: 'normal',
    }),
    input: (provided) => ({
      ...provided,
      color: 'var(--text-primary)',
      fontSize: '0.8125rem',
      margin: 0,
      padding: 0,
      lineHeight: 'normal',
    }),
    indicatorsContainer: (provided) => ({
      ...provided,
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      paddingRight: '0.25rem',
      flexShrink: 0,
    }),
    indicatorSeparator: () => ({
      display: 'none',
    }),
    dropdownIndicator: (provided) => ({
      ...provided,
      padding: '0 0.375rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      flexShrink: 0,
    }),
    menu: (provided) => ({
      ...provided,
      backgroundColor: 'var(--bg-surface)',
      border: '1px solid var(--border-color)',
      borderRadius: '0.5rem',
      boxShadow: 'var(--shadow-md, 0 4px 12px rgba(0, 0, 0, 0.08))',
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
      fontWeight: 400,
      padding: '0.5rem 0.75rem',
      borderRadius: '0.375rem',
      cursor: 'pointer',
      margin: '0.125rem 0',
      transition: 'background-color 0.15s ease',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
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
      components={{
        DropdownIndicator: CustomDropdownIndicator,
        SingleValue: CustomSingleValue,
      }}
      placeholder={placeholder}
      isSearchable={isSearchable}
      isDisabled={isDisabled}
    />
  );
};
