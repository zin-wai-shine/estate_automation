import React from 'react';
import ReactSelect, {
  components,
  type DropdownIndicatorProps,
  type SingleValueProps,
  type GroupBase,
  type StylesConfig,
} from 'react-select';
import { FiChevronDown } from 'react-icons/fi';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectGroup {
  label: string;
  options: SelectOption[];
}

export interface SelectProps {
  options: (SelectOption | SelectGroup)[];
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

const CustomDropdownIndicator: React.FC<DropdownIndicatorProps<SelectOption, false, GroupBase<SelectOption>>> = (props) => {
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

const CustomSingleValue: React.FC<SingleValueProps<SelectOption, false, GroupBase<SelectOption>>> = ({ children, ...props }) => {
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
  const selectedOption = React.useMemo(() => {
    for (const opt of options) {
      if ('options' in opt && Array.isArray((opt as SelectGroup).options)) {
        const found = (opt as SelectGroup).options.find((sub) => String(sub.value) === String(value));
        if (found) return found;
      } else if ('value' in opt && String((opt as SelectOption).value) === String(value)) {
        return opt as SelectOption;
      }
    }
    return null;
  }, [options, value]);

  const isLightMode =
    typeof document !== 'undefined' &&
    document.documentElement.getAttribute('data-theme') === 'light';

  const customStyles: StylesConfig<SelectOption, false, GroupBase<SelectOption>> = {
    container: (provided) => ({
      ...provided,
      width,
    }),
    control: (provided, state) => ({
      ...provided,
      minHeight: height,
      height,
      backgroundColor: isLightMode ? '#FFFFFF' : '#1D1F22',
      borderColor: state.isFocused
        ? (isLightMode ? '#2563EB' : 'rgba(255, 255, 255, 0.24)')
        : (isLightMode ? '#CBD5E1' : 'rgba(255, 255, 255, 0.1)'),
      borderRadius: '8px',
      boxShadow: 'none',
      fontSize: '0.84375rem',
      color: isLightMode ? '#0F172A' : '#ECEEF0',
      cursor: 'pointer',
      boxSizing: 'border-box',
      display: 'flex',
      alignItems: 'center',
      overflow: 'hidden',
      '&:hover': {
        borderColor: state.isFocused
          ? (isLightMode ? '#2563EB' : 'rgba(255, 255, 255, 0.24)')
          : (isLightMode ? '#94A3B8' : 'rgba(255, 255, 255, 0.18)'),
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
      backgroundColor: isLightMode ? '#FFFFFF' : '#25282B',
      border: isLightMode ? '1px solid #E2E8F0' : '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '8px',
      boxShadow: isLightMode ? '0 8px 24px rgba(0, 0, 0, 0.12)' : '0 10px 28px rgba(0, 0, 0, 0.55)',
      overflow: 'hidden',
      zIndex: 99999,
      marginTop: '4px',
      marginBottom: '4px',
    }),
    menuPortal: (provided) => ({
      ...provided,
      zIndex: 99999,
    }),
    menuList: (provided) => ({
      ...provided,
      padding: '0.25rem',
      maxHeight: '240px',
    }),
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isSelected
        ? (isLightMode ? '#2563EB' : '#326EE6')
        : state.isFocused
        ? (isLightMode ? '#F1F5F9' : '#2A2D32')
        : 'transparent',
      color: state.isSelected ? '#ffffff' : (isLightMode ? '#0F172A' : '#ECEEF0'),
      fontSize: '0.8125rem',
      fontWeight: 400,
      padding: '0.5rem 0.75rem',
      borderRadius: '6px',
      cursor: 'pointer',
      margin: '0.125rem 0',
      transition: 'background-color 0.15s ease',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      '&:active': {
        backgroundColor: isLightMode ? '#2563EB' : '#326EE6',
      },
    }),
    groupHeading: (provided) => ({
      ...provided,
      color: 'var(--text-muted, #71717A)',
      fontSize: '0.6875rem',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      padding: '0.45rem 0.75rem 0.2rem',
      margin: 0,
    }),
    group: (provided) => ({
      ...provided,
      padding: '0.125rem 0',
    }),
  };

  return (
    <ReactSelect<SelectOption, false, GroupBase<SelectOption>>
      id={id}
      className={className}
      value={selectedOption}
      onChange={(opt) => {
        if (opt) onChange(opt.value);
      }}
      options={options as (SelectOption | GroupBase<SelectOption>)[]}
      styles={customStyles}
      components={{
        DropdownIndicator: CustomDropdownIndicator,
        SingleValue: CustomSingleValue,
      }}
      placeholder={placeholder}
      isSearchable={isSearchable}
      isDisabled={isDisabled}
      menuPlacement="auto"
      menuPosition="fixed"
      menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
    />
  );
};
