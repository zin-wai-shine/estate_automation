import React, { useState, useEffect, useRef } from 'react';
import type { DynamicAIBoxConfig, CanvasPromptOption } from './FacebookWorkflowCanvas';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { useTheme } from '../../context/ThemeContext';
import { useScrollLock } from '../../hooks/useScrollLock';
import { getAIModelDisplayName, isImagePrompt } from './aiModelUtils';
import {
  FiArrowUp,
  FiCopy,
  FiCheck,
  FiX,
  FiPlus,
  FiEdit3,
  FiMaximize2,
} from 'react-icons/fi';
import { SiGooglegemini } from 'react-icons/si';

export const SparklesIcon: React.FC<{ size?: number; color?: string; style?: React.CSSProperties }> = ({
  size = 15,
  color = 'currentColor',
  style,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={style}>
    <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" />
  </svg>
);

export const OpenAIIcon: React.FC<{ size?: number; color?: string }> = ({ size = 18, color = '#10A37F' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1683a.071.071 0 0 1 .038.052v5.5826a4.5045 4.5045 0 0 1-4.4945 4.4947zm-9.66-4.5264a4.4707 4.4707 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1401-2.0474zm-1.127-10.742a4.4707 4.4707 0 0 1 2.3468-1.9729v5.6725a.7617.7617 0 0 0 .3879.6765l5.8144 3.3543-2.02 1.1683a.0757.0757 0 0 1-.071 0l-4.8303-2.7866a4.4992 4.4992 0 0 1-1.6278-6.1122zm16.637 4.906l-5.838-3.3733 2.02-1.1635a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4945 4.4945 0 0 1-.6765 8.1042v-5.6772a.7948.7948 0 0 0-.4068-.6815zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.5797V7.2473a.0852.0852 0 0 1 .0332-.0615l4.9318-2.8466a4.4945 4.4945 0 0 1 6.6437 4.5422zm-8.8418-2.1246l-2.02 1.1635a.0757.0757 0 0 1-.071 0l-4.8303-2.7913a4.4945 4.4945 0 0 1 5.1764-1.3725l-.142.0804 1.8869 1.0886v1.8313z" />
  </svg>
);

export const LaoZhangIcon: React.FC<{ size?: number; color?: string }> = ({ size = 15, color = '#2563EB' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="12" r="10.5" fill={color} />
    <text x="12" y="15.5" textAnchor="middle" fill="#FFFFFF" fontSize="8.5" fontWeight="800" fontFamily="system-ui, -apple-system, BlinkMacSystemFont, sans-serif" letterSpacing="-0.3px">API</text>
  </svg>
);

export const RunwareIcon: React.FC<{ size?: number; color?: string }> = ({ size = 15, color = '#10B981' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <rect width="24" height="24" rx="5" fill={color} />
    <path d="M7 6h6a3.5 3.5 0 0 1 3.5 3.5c0 1.6-1 2.9-2.4 3.3L17 18h-2.8l-2.5-4.8H9.5V18H7V6zm2.5 5h3.5a1.5 1.5 0 0 0 0-3H9.5v3z" fill="#FFFFFF" />
  </svg>
);

export const ModelSelectorMenu: React.FC<{
  provider: 'google_ai' | 'openai' | 'laozhang_ai' | 'runware_ai';
  model: string;
  filterType?: 'text' | 'image' | 'all';
  align?: 'left' | 'center' | 'right';
  onSelectModel: (provider: 'google_ai' | 'openai' | 'laozhang_ai' | 'runware_ai', model: string) => void;
}> = ({ provider, model, filterType = 'all', align = 'center', onSelectModel }) => {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isGoogle = provider === 'google_ai';
  const isLaoZhang = provider === 'laozhang_ai';
  const isRunware = provider === 'runware_ai';

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid var(--border-color)',
          color: 'var(--text-primary)',
          fontSize: '0.8125rem',
          fontWeight: 400,
          cursor: 'pointer',
          padding: '4px 12px',
          borderRadius: '20px',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.07)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
        }}
      >
        {isRunware ? (
          <RunwareIcon size={15} />
        ) : isLaoZhang ? (
          <LaoZhangIcon size={15} />
        ) : isGoogle ? (
          <SiGooglegemini style={{ fontSize: '15px', color: '#60A5FA' }} />
        ) : (
          <OpenAIIcon size={15} color="#34D399" />
        )}
        <span style={{ fontWeight: 500 }}>{isRunware ? 'Runware AI' : isLaoZhang ? 'LaoZhang AI' : isGoogle ? 'Gemini' : 'ChatGPT'}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 400 }}>· {getAIModelDisplayName(provider, model)}</span>
        <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginLeft: '2px' }}>▾</span>
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: align === 'left' ? 0 : align === 'right' ? 'auto' : '50%',
            right: align === 'right' ? 0 : 'auto',
            transform: align === 'center' ? 'translateX(-50%)' : 'none',
            width: '260px',
            backgroundColor: isDark ? '#1C2128' : 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.5)' : '0 8px 24px rgba(0,0,0,0.1)',
            padding: '4px',
            zIndex: 100005,
          }}
        >
          {/* GOOGLE GEMINI (Text Only) */}
          {filterType !== 'image' && (
            <>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', padding: '4px 8px', fontWeight: 500, letterSpacing: '0.3px' }}>
                Google Gemini
              </div>

              <button
                type="button"
                onClick={() => {
                  onSelectModel('google_ai', 'gemini-flash-latest');
                  setIsOpen(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: isGoogle && model === 'gemini-flash-latest' ? (isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)') : 'transparent',
                  color: 'var(--text-primary)',
                  fontSize: '0.75rem',
                  fontWeight: 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  if (!(isGoogle && model === 'gemini-flash-latest')) {
                    e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'var(--bg-surface-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!(isGoogle && model === 'gemini-flash-latest')) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <SiGooglegemini style={{ fontSize: '13px', color: '#60A5FA' }} />
                <span>Gemini Flash (Fast)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onSelectModel('google_ai', 'gemini-1.5-pro');
                  setIsOpen(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: isGoogle && model === 'gemini-1.5-pro' ? (isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)') : 'transparent',
                  color: 'var(--text-primary)',
                  fontSize: '0.75rem',
                  fontWeight: 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  if (!(isGoogle && model === 'gemini-1.5-pro')) {
                    e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'var(--bg-surface-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!(isGoogle && model === 'gemini-1.5-pro')) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <SiGooglegemini style={{ fontSize: '13px', color: '#60A5FA' }} />
                <span>Gemini 1.5 Pro (Deep Reasoning)</span>
              </button>

              <div style={{ height: '1px', backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'var(--border-color)', margin: '4px 0' }} />
            </>
          )}

          {/* OPENAI CHATGPT (Text Models) */}
          {filterType !== 'image' && (
            <>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', padding: '4px 8px', fontWeight: 500, letterSpacing: '0.3px' }}>
                OpenAI ChatGPT
              </div>

              <button
                type="button"
                onClick={() => {
                  onSelectModel('openai', 'gpt-4o');
                  setIsOpen(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: !isGoogle && !isLaoZhang && model === 'gpt-4o' ? (isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)') : 'transparent',
                  color: 'var(--text-primary)',
                  fontSize: '0.75rem',
                  fontWeight: 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  if (!(!isGoogle && !isLaoZhang && model === 'gpt-4o')) {
                    e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'var(--bg-surface-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!(!isGoogle && !isLaoZhang && model === 'gpt-4o')) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <OpenAIIcon size={13} color="#34D399" />
                <span>GPT-4o (High Precision)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onSelectModel('openai', 'gpt-4o-mini');
                  setIsOpen(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: !isGoogle && !isLaoZhang && model === 'gpt-4o-mini' ? (isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)') : 'transparent',
                  color: 'var(--text-primary)',
                  fontSize: '0.75rem',
                  fontWeight: 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  if (!(!isGoogle && !isLaoZhang && model === 'gpt-4o-mini')) {
                    e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'var(--bg-surface-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!(!isGoogle && !isLaoZhang && model === 'gpt-4o-mini')) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <OpenAIIcon size={13} color="#34D399" />
                <span>GPT-4o-mini (Lightweight)</span>
              </button>

              <div style={{ height: '1px', backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'var(--border-color)', margin: '4px 0' }} />
            </>
          )}

          {/* OPENAI IMAGE GENERATION (Image Models Only) */}
          {filterType !== 'text' && (
            <>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', padding: '4px 8px', fontWeight: 500, letterSpacing: '0.3px' }}>
                OpenAI Image AI
              </div>

              <button
                type="button"
                onClick={() => {
                  onSelectModel('openai', 'gpt-image-2.5-sunburst');
                  setIsOpen(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: !isGoogle && !isLaoZhang && model === 'gpt-image-2.5-sunburst' ? (isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)') : 'transparent',
                  color: 'var(--text-primary)',
                  fontSize: '0.75rem',
                  fontWeight: 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  if (!(!isGoogle && !isLaoZhang && model === 'gpt-image-2.5-sunburst')) {
                    e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'var(--bg-surface-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!(!isGoogle && !isLaoZhang && model === 'gpt-image-2.5-sunburst')) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <OpenAIIcon size={13} color="#34D399" />
                <span>GPT Image 2.5 Sunburst</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onSelectModel('openai', 'gpt-image-2.5-flare');
                  setIsOpen(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: !isGoogle && !isLaoZhang && model === 'gpt-image-2.5-flare' ? (isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)') : 'transparent',
                  color: 'var(--text-primary)',
                  fontSize: '0.75rem',
                  fontWeight: 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  if (!(!isGoogle && !isLaoZhang && model === 'gpt-image-2.5-flare')) {
                    e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'var(--bg-surface-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!(!isGoogle && !isLaoZhang && model === 'gpt-image-2.5-flare')) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <OpenAIIcon size={13} color="#34D399" />
                <span>GPT Image 2.5 Flare</span>
              </button>

              <div style={{ height: '1px', backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'var(--border-color)', margin: '4px 0' }} />
            </>
          )}

          {/* LAOZHANG AI (Text Models) */}
          {filterType !== 'image' && (
            <>
              <div style={{ fontSize: '0.6875rem', color: '#60A5FA', padding: '4px 8px', fontWeight: 600, letterSpacing: '0.3px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <LaoZhangIcon size={12} />
                <span>LaoZhang API Models</span>
              </div>

              <button
                type="button"
                onClick={() => {
                  onSelectModel('laozhang_ai', 'gpt-4o');
                  setIsOpen(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: isLaoZhang && model === 'gpt-4o' ? (isDark ? 'rgba(37, 99, 235, 0.18)' : 'rgba(37, 99, 235, 0.12)') : 'transparent',
                  color: 'var(--text-primary)',
                  fontSize: '0.75rem',
                  fontWeight: 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  if (!(isLaoZhang && model === 'gpt-4o')) {
                    e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'var(--bg-surface-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!(isLaoZhang && model === 'gpt-4o')) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <LaoZhangIcon size={13} color="#2563EB" />
                <span>GPT-4o (LaoZhang Relay)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onSelectModel('laozhang_ai', 'gpt-4.1');
                  setIsOpen(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: isLaoZhang && model === 'gpt-4.1' ? (isDark ? 'rgba(37, 99, 235, 0.18)' : 'rgba(37, 99, 235, 0.12)') : 'transparent',
                  color: 'var(--text-primary)',
                  fontSize: '0.75rem',
                  fontWeight: 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  if (!(isLaoZhang && model === 'gpt-4.1')) {
                    e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'var(--bg-surface-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!(isLaoZhang && model === 'gpt-4.1')) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <LaoZhangIcon size={13} color="#3B82F6" />
                <span>GPT-4.1 (Next Gen)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onSelectModel('laozhang_ai', 'gpt-4o-mini');
                  setIsOpen(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: isLaoZhang && model === 'gpt-4o-mini' ? (isDark ? 'rgba(37, 99, 235, 0.18)' : 'rgba(37, 99, 235, 0.12)') : 'transparent',
                  color: 'var(--text-primary)',
                  fontSize: '0.75rem',
                  fontWeight: 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  if (!(isLaoZhang && model === 'gpt-4o-mini')) {
                    e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'var(--bg-surface-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!(isLaoZhang && model === 'gpt-4o-mini')) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <LaoZhangIcon size={13} color="#10B981" />
                <span>GPT-4o-mini (Lightweight)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onSelectModel('laozhang_ai', 'deepseek-v3');
                  setIsOpen(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: isLaoZhang && model === 'deepseek-v3' ? (isDark ? 'rgba(37, 99, 235, 0.18)' : 'rgba(37, 99, 235, 0.12)') : 'transparent',
                  color: 'var(--text-primary)',
                  fontSize: '0.75rem',
                  fontWeight: 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  if (!(isLaoZhang && model === 'deepseek-v3')) {
                    e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'var(--bg-surface-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!(isLaoZhang && model === 'deepseek-v3')) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <LaoZhangIcon size={13} color="#8B5CF6" />
                <span>DeepSeek V3 (State of the Art)</span>
              </button>

              <div style={{ height: '1px', backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'var(--border-color)', margin: '4px 0' }} />
            </>
          )}

          {/* RUNWARE AI (Image Models Only) */}
          {filterType !== 'text' && (
            <>
              <div style={{ fontSize: '0.6875rem', color: '#10B981', padding: '4px 8px', fontWeight: 600, letterSpacing: '0.3px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <RunwareIcon size={12} />
                <span>Runware Image & AI Models</span>
              </div>

              {/* FLUX.1 Schnell - Least tokens / compute */}
              <button
                type="button"
                onClick={() => {
                  onSelectModel('runware_ai', 'runware:101@1');
                  setIsOpen(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: isRunware && model === 'runware:101@1' ? (isDark ? 'rgba(16, 185, 129, 0.18)' : 'rgba(16, 185, 129, 0.12)') : 'transparent',
                  color: 'var(--text-primary)',
                  fontSize: '0.75rem',
                  fontWeight: 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  if (!(isRunware && model === 'runware:101@1')) {
                    e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'var(--bg-surface-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!(isRunware && model === 'runware:101@1')) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <RunwareIcon size={13} color="#10B981" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                  <span style={{ fontWeight: 500 }}>FLUX.1 Schnell <span style={{ fontSize: '0.6875rem', color: '#10B981', fontWeight: 600 }}>⚡ Least Tokens (4 Steps)</span></span>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>runware:101@1 · Fastest & lowest compute cost</span>
                </div>
              </button>

              {/* SDXL Realism */}
              <button
                type="button"
                onClick={() => {
                  onSelectModel('runware_ai', 'runware:100@1');
                  setIsOpen(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: isRunware && model === 'runware:100@1' ? (isDark ? 'rgba(16, 185, 129, 0.18)' : 'rgba(16, 185, 129, 0.12)') : 'transparent',
                  color: 'var(--text-primary)',
                  fontSize: '0.75rem',
                  fontWeight: 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  if (!(isRunware && model === 'runware:100@1')) {
                    e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'var(--bg-surface-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!(isRunware && model === 'runware:100@1')) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <RunwareIcon size={13} color="#10B981" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                  <span style={{ fontWeight: 500 }}>SDXL Realism <span style={{ fontSize: '0.6875rem', color: '#3B82F6', fontWeight: 600 }}>🏛️ Photorealistic</span></span>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>runware:100@1 · Real estate architecture</span>
                </div>
              </button>

              {/* Juggernaut XL */}
              <button
                type="button"
                onClick={() => {
                  onSelectModel('runware_ai', 'civitai:133005@782002');
                  setIsOpen(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: isRunware && model === 'civitai:133005@782002' ? (isDark ? 'rgba(16, 185, 129, 0.18)' : 'rgba(16, 185, 129, 0.12)') : 'transparent',
                  color: 'var(--text-primary)',
                  fontSize: '0.75rem',
                  fontWeight: 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  if (!(isRunware && model === 'civitai:133005@782002')) {
                    e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'var(--bg-surface-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!(isRunware && model === 'civitai:133005@782002')) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <RunwareIcon size={13} color="#10B981" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                  <span style={{ fontWeight: 500 }}>Juggernaut XL <span style={{ fontSize: '0.6875rem', color: '#8B5CF6', fontWeight: 600 }}>✨ Ultra Detail</span></span>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>civitai:133005@782002 · High-end interior styling</span>
                </div>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  durationMs?: number;
  model?: string;
  isPromptProposal?: boolean;
}

const SAMPLE_POST_TEXT = `[For Rent] Elio Del Nest Udomsuk
ห้องสวย ชั้น 18 วิวสระว่ายน้ำ ทิศเหนือ ลมดี ไม่ร้อน
ขนาด 31.5 ตร.ม. 1 ห้องนอน 1 ห้องน้ำ
เฟอร์นิเจอร์ + เครื่องใช้ไฟฟ้าครบ:
- ทีวี 50 นิ้ว แอร์ 2 เครื่อง
- ตู้เย็น ไมโครเวฟ เครื่องทำน้ำอุ่น เครื่องซักผ้าฝาหน้า
ทำเลดี 700 ม. ถึง BTS อุดมสุข มีรถตู้รับ-ส่ง
สิ่งอำนวยความสะดวก: ฟิตเนส สระว่ายน้ำ คีย์การ์ด รปภ. 24 ชม.
ค่าเช่า 13,500 บาท/เดือน (สัญญา 1 ปี มัดจำ 2 เดือน)
ติดต่อ คุณแพร โทร 081-234-5678 Line: @pear_prop`;

interface AITrainingChatbotProps {
  box: DynamicAIBoxConfig;
  availablePrompts: CanvasPromptOption[];
  allowEditPrompt?: boolean;
  isSettingsOpen: boolean;
  onCloseSettings: () => void;
  onUpdateBox: (id: string, updates: Partial<DynamicAIBoxConfig>) => void;
  onToggleBox: (id: string) => void;
  onDuplicateBox: (box: DynamicAIBoxConfig) => void;
  onDeleteBox: (id: string) => void;
  onClose: () => void;
}

export const AITrainingChatbot: React.FC<AITrainingChatbotProps> = ({
  box,
  availablePrompts,
  allowEditPrompt = true,
  isSettingsOpen,
  onCloseSettings,
  onUpdateBox,
  onToggleBox,
  onDuplicateBox: _onDuplicateBox,
  onDeleteBox,
  onClose: _onClose,
}) => {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';

  // Chatbot State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const isGoogle = box.provider === 'google_ai';
  const isLaoZhang = box.provider === 'laozhang_ai';
  const isRunware = box.provider === 'runware_ai';
  const brandColor = isRunware ? '#10B981' : isLaoZhang ? '#2563EB' : isGoogle ? '#3B82F6' : '#10A37F';

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  // Auto-resize input textarea dynamically like ChatGPT
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const scrollHeight = el.scrollHeight;
    const maxHeight = 200;
    if (scrollHeight > maxHeight) {
      el.style.height = `${maxHeight}px`;
      el.style.overflowY = 'auto';
    } else {
      el.style.height = `${Math.max(scrollHeight, 24)}px`;
      el.style.overflowY = 'hidden';
    }
  }, [inputValue]);

  // Toast timer
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const [expandedMsgIds, setExpandedMsgIds] = useState<Record<string, boolean>>({});
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<string>('');
  const [assistantModes, setAssistantModes] = useState<Record<string, 'original' | 'write_like_me'>>({});
  const [fullscreenMsgId, setFullscreenMsgId] = useState<string | null>(null);

  const fullscreenModalRef = useRef<HTMLDivElement>(null);

  // Universal scroll isolation when fullscreen modal is open
  useScrollLock(!!fullscreenMsgId, { containerRef: fullscreenModalRef });

  const formatMessageTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (isToday) return `Today ${timeStr}`;
    if (isYesterday) return `Yesterday ${timeStr}`;
    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${timeStr}`;
  };

  const handleStartEdit = (msg: ChatMessage) => {
    setEditingMsgId(msg.id);
    setEditingContent(msg.content);
  };

  const handleCancelEdit = () => {
    setEditingMsgId(null);
    setEditingContent('');
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
  };

  const executeAIGeneration = async (promptToSend: string, currentHistory: ChatMessage[]) => {
    if (!promptToSend || isGenerating) return;
    setIsGenerating(true);
    abortControllerRef.current = new AbortController();
    const startTime = Date.now();

    try {
      const resp = await fetch('http://localhost:8085/api/facebook-import/generate-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          provider: box.provider,
          model: box.model,
          template_id: box.templateId || '',
          template_name: box.title,
          template_text: box.templateText || '',
          raw_content: promptToSend,
          custom_prompt: box.customPrompt || '',
        }),
      });

      const data = await resp.json();
      const durationMs = Date.now() - startTime;

      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate output from AI model.');
      }

      const generatedContent = data.generated_content || '';
      const isPromptProposal =
        promptToSend.toLowerCase().includes('prompt') ||
        promptToSend.toLowerCase().includes('instruction') ||
        promptToSend.toLowerCase().includes('template') ||
        generatedContent.includes('RULES:') ||
        generatedContent.includes('=== INSTRUCTIONS ===');

      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}-ai`,
        role: 'assistant',
        content: generatedContent,
        timestamp: Date.now(),
        durationMs,
        model: box.model,
        isPromptProposal,
      };

      setMessages([...currentHistory, assistantMsg]);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return;
      }
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now()}-err`,
        role: 'assistant',
        content: `⚠️ Failed to get response: ${err.message || 'Check your AI API key or backend connection'}.`,
        timestamp: Date.now(),
        durationMs: Date.now() - startTime,
        model: box.model,
      };
      setMessages([...currentHistory, errorMsg]);
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
      textareaRef.current?.focus();
    }
  };

  const handleSendEdit = (msgId: string) => {
    const trimmed = editingContent.trim();
    if (!trimmed) return;
    const targetIdx = messages.findIndex((m) => m.id === msgId);
    if (targetIdx === -1) return;

    setEditingMsgId(null);
    setEditingContent('');

    // Keep history up to this edited message and update its content
    const truncatedHistory = messages.slice(0, targetIdx + 1).map((m, idx) =>
      idx === targetIdx ? { ...m, content: trimmed, timestamp: Date.now() } : m
    );

    setMessages(truncatedHistory);
    // Directly generate new assistant response under this edited conversation point
    executeAIGeneration(trimmed, truncatedHistory);
  };

  const toggleExpand = (id: string) => {
    setExpandedMsgIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    showToast('Copied to clipboard');
  };

  const handleAdoptPrompt = (newPromptText: string) => {
    onUpdateBox(box.id, { templateText: newPromptText });
    showToast('✨ Updated prompt instructions for this node');
  };

  // Send message from bottom chat input bar
  const handleSendMessage = (textToSend?: string) => {
    const promptToSend = (textToSend !== undefined ? textToSend : inputValue).trim();
    if (!promptToSend || isGenerating) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: promptToSend,
      timestamp: Date.now(),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInputValue('');
    executeAIGeneration(promptToSend, newHistory);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        backgroundColor: isDark ? '#0D1117' : 'var(--bg-main)',
        color: isDark ? '#E6EDF3' : 'var(--text-primary)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Toast Feedback */}
      {toastMessage && (
        <div
          style={{
            position: 'absolute',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 110,
            backgroundColor: isDark ? '#161B22' : 'var(--bg-surface)',
            border: `1px solid ${brandColor}`,
            color: isDark ? '#FFFFFF' : 'var(--text-primary)',
            padding: '6px 14px',
            borderRadius: '16px',
            fontSize: '0.75rem',
            fontWeight: 400,
            boxShadow: isDark ? '0 4px 14px rgba(0,0,0,0.4)' : '0 4px 14px rgba(0,0,0,0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
          }}
        >
          <SparklesIcon size={12} color={brandColor} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* BODY CONTAINER */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
        {/* ========================================================= */}
        {/* SLIDE-OVER DRAWER: Prompt Instructions & Node Settings    */}
        {/* ========================================================= */}
        {isSettingsOpen && (
          <div
            style={{
              width: '360px',
              borderRight: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid var(--border-color)',
              backgroundColor: isDark ? '#161B22' : 'var(--bg-secondary)',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 50,
              flexShrink: 0,
              animation: 'fadeIn 0.15s ease',
            }}
          >
            {/* Drawer Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid var(--border-color)',
              }}
            >
              <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: isDark ? '#FFFFFF' : 'var(--text-primary)' }}>
                Prompt Instructions & Settings
              </div>
              <button
                type="button"
                onClick={onCloseSettings}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '14px',
                  cursor: 'pointer',
                  padding: '2px',
                }}
              >
                <FiX />
              </button>
            </div>

            {/* Drawer Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {/* Title & Status */}
              <div>
                <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 400, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  Node Title
                </label>
                <input
                  type="text"
                  value={box.title}
                  onChange={(e) => onUpdateBox(box.id, { title: e.target.value })}
                  style={{
                    width: '100%',
                    height: '32px',
                    backgroundColor: isDark ? '#0D1117' : 'var(--bg-surface)',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid var(--border-color)',
                    borderRadius: '4px',
                    padding: '0 0.5rem',
                    color: isDark ? '#FFFFFF' : 'var(--text-primary)',
                    fontSize: '0.75rem',
                    fontWeight: 400,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Status Switch */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 400 }}>Workflow Active</span>
                <button
                  type="button"
                  onClick={() => onToggleBox(box.id)}
                  style={{
                    width: '32px',
                    height: '18px',
                    borderRadius: '9px',
                    backgroundColor: box.enabled ? '#10B981' : isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)',
                    border: 'none',
                    position: 'relative',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: '2px',
                      left: box.enabled ? '16px' : '2px',
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      backgroundColor: '#FFFFFF',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
                      transition: 'left 0.15s ease',
                    }}
                  />
                </button>
              </div>

                {/* Template Picker - Non-bold select text (Content prompts only) */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 400, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    Load from Template
                  </label>
                  {(() => {
                    const contentPrompts = availablePrompts.filter((p) => !isImagePrompt(p));
                    return (
                      <Select
                        options={[
                          ...contentPrompts.map((p) => ({
                            value: String(p.id),
                            label: p.name,
                          })),
                          { value: 'custom', label: 'Custom Prompt' },
                        ]}
                        value={
                          contentPrompts.some((p) => String(p.id) === String(box.templateId))
                            ? String(box.templateId)
                            : contentPrompts.some((p) => p.name === box.title)
                            ? String(contentPrompts.find((p) => p.name === box.title)!.id)
                            : 'custom'
                        }
                        onChange={(val) => {
                          if (val === 'custom') {
                            onUpdateBox(box.id, { templateId: 'custom' });
                            return;
                          }
                          const matched = contentPrompts.find((p) => String(p.id) === String(val));
                          if (matched) {
                            onUpdateBox(box.id, {
                              templateId: String(matched.id),
                              templateText: matched.templateText,
                              title: box.title || matched.name,
                            });
                            showToast(`Loaded: ${matched.name}`);
                          }
                        }}
                        height="32px"
                      />
                    );
                  })()}
                </div>

              {/* Prompt Textarea */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '200px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <label style={{ fontSize: '0.6875rem', fontWeight: 400, color: 'var(--text-muted)' }}>
                    Prompt Template Instructions
                  </label>
                  <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                    {box.templateText?.length || 0} chars
                  </span>
                </div>
                <textarea
                  value={box.templateText}
                  readOnly={!allowEditPrompt}
                  onChange={(e) => onUpdateBox(box.id, { templateText: e.target.value })}
                  placeholder="Enter prompt instructions for this AI process..."
                  style={{
                    width: '100%',
                    flex: 1,
                    minHeight: '160px',
                    backgroundColor: isDark ? '#0D1117' : 'var(--bg-surface)',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid var(--border-color)',
                    borderRadius: '4px',
                    padding: '0.5rem',
                    color: isDark ? '#FFFFFF' : 'var(--text-primary)',
                    fontSize: '0.75rem',
                    fontWeight: 400,
                    lineHeight: 1.5,
                    fontFamily: `'SF Mono', 'Fira Code', monospace`,
                    outline: 'none',
                    resize: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Drawer Delete Action */}
              <div style={{ paddingTop: '0.5rem', borderTop: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid var(--border-color)' }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDeleteBox(box.id)}
                  style={{
                    width: '100%',
                    height: '28px',
                    fontSize: '0.6875rem',
                    fontWeight: 400,
                    color: '#EF4444',
                    borderColor: 'rgba(239, 68, 68, 0.3)',
                  }}
                >
                  Delete AI Node
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* MAIN CHATBOT WINDOW (100% Genuine ChatGPT & Gemini style)  */}
        {/* ========================================================= */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            backgroundColor: isDark ? '#0D1117' : 'var(--bg-main)',
            height: '100%',
          }}
        >
          {/* MESSAGES FLOW */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '0.75rem 1.25rem',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                width: isSettingsOpen ? '90%' : '70%',
                minWidth: '320px',
                margin: '0 auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem',
                flex: 1,
                transition: 'width 0.2s ease',
              }}
            >
              {/* CLEAN EMPTY STATE (Just like ChatGPT and Gemini) */}
              {messages.length === 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: 'auto',
                    maxWidth: '480px',
                    textAlign: 'center',
                    padding: '2rem 1rem',
                  }}
                >
                  {/* Logo */}
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      backgroundColor: isRunware
                        ? (isDark ? 'rgba(16, 185, 129, 0.18)' : 'rgba(16, 185, 129, 0.12)')
                        : isLaoZhang
                        ? (isDark ? 'rgba(37, 99, 235, 0.15)' : 'rgba(37, 99, 235, 0.1)')
                        : isGoogle
                        ? (isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.08)')
                        : (isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.08)'),
                      border: `1px solid ${
                        isRunware
                          ? (isDark ? 'rgba(16, 185, 129, 0.4)' : 'rgba(16, 185, 129, 0.3)')
                          : isLaoZhang
                          ? (isDark ? 'rgba(37, 99, 235, 0.35)' : 'rgba(37, 99, 235, 0.25)')
                          : isGoogle
                          ? (isDark ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.2)')
                          : (isDark ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.2)')
                      }`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '1rem',
                    }}
                  >
                    {isRunware ? (
                      <RunwareIcon size={28} />
                    ) : isLaoZhang ? (
                      <LaoZhangIcon size={28} />
                    ) : isGoogle ? (
                      <SiGooglegemini style={{ fontSize: '28px', color: '#60A5FA' }} />
                    ) : (
                      <OpenAIIcon size={28} color="#34D399" />
                    )}
                  </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', margin: '0 0 0.375rem 0' }}>
                  <input
                    type="text"
                    value={box.title}
                    onChange={(e) => onUpdateBox(box.id, { title: e.target.value })}
                    placeholder="Node Name"
                    title="Click to rename"
                    style={{
                      fontSize: '1.125rem',
                      fontWeight: 600,
                      color: isDark ? '#FFFFFF' : 'var(--text-primary)',
                      backgroundColor: 'transparent',
                      border: '1px solid transparent',
                      borderRadius: '6px',
                      padding: '2px 8px',
                      textAlign: 'center',
                      outline: 'none',
                      width: `${Math.max(140, Math.min(320, (box.title?.length || 10) * 11 + 20))}px`,
                      cursor: 'text',
                      transition: 'all 0.15s ease',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#3B82F6';
                      e.currentTarget.style.backgroundColor = isDark ? '#1E293B' : '#FFFFFF';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'transparent';
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                    }}
                  />
                  <FiEdit3 style={{ fontSize: '12px', color: 'var(--text-muted)', opacity: 0.5, pointerEvents: 'none' }} />
                </div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '0 0 1.5rem 0', lineHeight: 1.5, fontWeight: 400 }}>
                  Test your prompt with sample property listings or chat to refine it.
                </p>

                {/* 2 Clean Starter Pills */}
                <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => handleSendMessage(SAMPLE_POST_TEXT)}
                    style={{
                      padding: '0.625rem 0.875rem',
                      borderRadius: '0.5rem',
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'var(--bg-surface)',
                      border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid var(--border-color)',
                      boxShadow: isDark ? 'none' : '0 1px 3px rgba(0, 0, 0, 0.04)',
                      color: 'var(--text-primary)',
                      fontSize: '0.8125rem',
                      fontWeight: 400,
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'var(--bg-secondary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.04)' : 'var(--bg-surface)';
                    }}
                  >
                    <span>📋 Test with Sample Facebook Condo Post</span>
                    <span style={{ fontSize: '0.75rem', color: brandColor }}>Run →</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSendMessage("Make the current prompt instructions shorter and more concise, highlighting only rent price, BTS station, and Line ID.")}
                    style={{
                      padding: '0.625rem 0.875rem',
                      borderRadius: '0.5rem',
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'var(--bg-surface)',
                      border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid var(--border-color)',
                      boxShadow: isDark ? 'none' : '0 1px 3px rgba(0, 0, 0, 0.04)',
                      color: 'var(--text-primary)',
                      fontSize: '0.8125rem',
                      fontWeight: 400,
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'var(--bg-secondary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.04)' : 'var(--bg-surface)';
                    }}
                  >
                    <span>✍️ Refine Prompt: Make shorter & highlight Line ID</span>
                    <span style={{ fontSize: '0.75rem', color: brandColor }}>Ask →</span>
                  </button>
                </div>
              </div>
            )}

            {/* MESSAGES */}
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              const isExpanded = !!expandedMsgIds[msg.id];
              const isLong = msg.content.length > 250 || msg.content.split('\n').length > 6;

              if (isUser) {
                return (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      width: '100%',
                      margin: '0.75rem 0',
                    }}
                  >
                    {/* Timestamp centered (Image 1) */}
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: isDark ? '#8E9196' : 'var(--text-muted)',
                        marginBottom: '0.5rem',
                        textAlign: 'center',
                        width: '100%',
                        fontWeight: 400,
                      }}
                    >
                      {formatMessageTime(msg.timestamp)}
                    </div>

                    {/* Edit Mode vs Normal Bubble */}
                    {editingMsgId === msg.id ? (
                      /* USER EDIT MODE (Image 3) */
                      <div
                        style={{
                          width: '100%',
                          backgroundColor: isDark ? '#161B22' : 'var(--bg-surface)',
                          border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid var(--border-color)',
                          borderRadius: '1.25rem',
                          padding: '1rem 1.25rem',
                          boxShadow: isDark ? '0 4px 20px rgba(0, 0, 0, 0.4)' : '0 4px 20px rgba(0, 0, 0, 0.08)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.75rem',
                          boxSizing: 'border-box',
                        }}
                      >
                        <textarea
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          rows={Math.min(Math.max(editingContent.split('\n').length + 1, 4), 14)}
                          style={{
                            width: '100%',
                            backgroundColor: 'transparent',
                            border: 'none',
                            color: isDark ? '#FFFFFF' : 'var(--text-primary)',
                            fontSize: '0.875rem',
                            lineHeight: 1.55,
                            outline: 'none',
                            resize: 'none',
                            boxSizing: 'border-box',
                            fontFamily: 'inherit',
                          }}
                          autoFocus
                        />
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: '0.5rem',
                          }}
                        >
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            style={{
                              backgroundColor: isDark ? '#383A40' : '#E2E8F0',
                              color: isDark ? '#E0E0E0' : '#334155',
                              border: 'none',
                              borderRadius: '1.5rem',
                              padding: '6px 16px',
                              fontSize: '0.8125rem',
                              fontWeight: 500,
                              cursor: 'pointer',
                              transition: 'background-color 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = isDark ? '#45484E' : '#CBD5E1';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = isDark ? '#383A40' : '#E2E8F0';
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSendEdit(msg.id)}
                            disabled={!editingContent.trim() || isGenerating}
                            style={{
                              backgroundColor: isDark ? '#FFFFFF' : '#0F172A',
                              color: isDark ? '#000000' : '#FFFFFF',
                              border: 'none',
                              borderRadius: '1.5rem',
                              padding: '6px 20px',
                              fontSize: '0.8125rem',
                              fontWeight: 600,
                              cursor: editingContent.trim() && !isGenerating ? 'pointer' : 'not-allowed',
                              transition: 'opacity 0.15s ease',
                              opacity: editingContent.trim() && !isGenerating ? 1 : 0.6,
                            }}
                          >
                            Send
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* USER MESSAGE BUBBLE (Image 1) */
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-end',
                          maxWidth: '78%',
                          minWidth: '240px',
                        }}
                      >
                        <div
                          style={{
                            backgroundColor: isDark ? '#163F79' : '#2563EB',
                            borderRadius: '1.25rem',
                            padding: '1rem 1.25rem',
                            color: '#FFFFFF',
                            fontSize: '0.875rem',
                            lineHeight: 1.55,
                            wordBreak: 'break-word',
                            whiteSpace: 'pre-wrap',
                            boxShadow: isDark ? '0 2px 10px rgba(0, 0, 0, 0.25)' : '0 2px 10px rgba(37, 99, 235, 0.25)',
                            position: 'relative',
                            width: '100%',
                            boxSizing: 'border-box',
                          }}
                        >
                          <div
                            style={{
                              maxHeight: isLong && !isExpanded ? '180px' : 'none',
                              overflow: isLong && !isExpanded ? 'hidden' : 'visible',
                              position: 'relative',
                            }}
                          >
                            {msg.content}
                            {isLong && !isExpanded && (
                              <div
                                style={{
                                  position: 'absolute',
                                  bottom: 0,
                                  left: 0,
                                  right: 0,
                                  height: '40px',
                                  background: isDark
                                    ? 'linear-gradient(to bottom, rgba(22, 63, 121, 0), rgba(22, 63, 121, 0.95))'
                                    : 'linear-gradient(to bottom, rgba(37, 99, 235, 0), rgba(37, 99, 235, 0.95))',
                                  pointerEvents: 'none',
                                }}
                              />
                            )}
                          </div>

                          {/* Show more / Show less toggle */}
                          {isLong && (
                            <button
                              type="button"
                              onClick={() => toggleExpand(msg.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'rgba(255, 255, 255, 0.85)',
                                fontSize: '0.8125rem',
                                fontWeight: 400,
                                cursor: 'pointer',
                                padding: '6px 0 0 0',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                outline: 'none',
                              }}
                            >
                              <span>{isExpanded ? 'Show less ⌃' : 'Show more ⌄'}</span>
                            </button>
                          )}
                        </div>

                        {/* Copy & Edit Action Icons below bubble (Image 1) */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            marginTop: '0.375rem',
                            marginRight: '0.375rem',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => handleCopyText(msg.content, msg.id)}
                            title="Copy message"
                            style={{
                              background: 'none',
                              border: 'none',
                              color: copiedId === msg.id ? '#10B981' : isDark ? 'rgba(255, 255, 255, 0.5)' : 'var(--text-muted)',
                              cursor: 'pointer',
                              padding: '4px',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'color 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = isDark ? '#FFFFFF' : 'var(--text-primary)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = copiedId === msg.id ? '#10B981' : isDark ? 'rgba(255, 255, 255, 0.5)' : 'var(--text-muted)';
                            }}
                          >
                            {copiedId === msg.id ? <FiCheck style={{ fontSize: '15px' }} /> : <FiCopy style={{ fontSize: '15px' }} />}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleStartEdit(msg)}
                            title="Edit message"
                            style={{
                              background: 'none',
                              border: 'none',
                              color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'var(--text-muted)',
                              cursor: 'pointer',
                              padding: '4px',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'color 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = isDark ? '#FFFFFF' : 'var(--text-primary)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = isDark ? 'rgba(255, 255, 255, 0.5)' : 'var(--text-muted)';
                            }}
                          >
                            <FiEdit3 style={{ fontSize: '15px' }} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              /* ASSISTANT MESSAGE CARD (Image 2) */
              const currentMode = assistantModes[msg.id] || 'original';
              return (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    width: '100%',
                    margin: '0.75rem 0',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      backgroundColor: isDark ? '#161B22' : 'var(--bg-surface)',
                      border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid var(--border-color)',
                      borderRadius: '1.25rem',
                      padding: '1.125rem 1.25rem',
                      boxShadow: isDark ? '0 4px 18px rgba(0, 0, 0, 0.35)' : '0 2px 12px rgba(0, 0, 0, 0.05)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.875rem',
                      boxSizing: 'border-box',
                    }}
                  >
                    {/* Header bar (Image 2) */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingBottom: '0.625rem',
                        borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid var(--border-color)',
                      }}
                    >
                      <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: isDark ? '#9CA3AF' : 'var(--text-secondary)' }}>
                        {box.title || 'Writing'}
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {/* ① Original pill */}
                        <button
                          type="button"
                          onClick={() => setAssistantModes((prev) => ({ ...prev, [msg.id]: 'original' }))}
                          style={{
                            backgroundColor: currentMode === 'original'
                              ? (isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)')
                              : 'transparent',
                            color: currentMode === 'original'
                              ? (isDark ? '#FFFFFF' : 'var(--text-primary)')
                              : (isDark ? '#9CA3AF' : 'var(--text-muted)'),
                            border: 'none',
                            borderRadius: '1rem',
                            padding: '3px 10px',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          ① Original
                        </button>

                        {/* ② Write Like Me pill */}
                        <button
                          type="button"
                          onClick={() => {
                            setAssistantModes((prev) => ({ ...prev, [msg.id]: 'write_like_me' }));
                            showToast('Applied "Write Like Me" tone style');
                          }}
                          style={{
                            backgroundColor: currentMode === 'write_like_me'
                              ? (isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)')
                              : 'transparent',
                            color: currentMode === 'write_like_me'
                              ? (isDark ? '#FFFFFF' : 'var(--text-primary)')
                              : (isDark ? '#9CA3AF' : 'var(--text-muted)'),
                            border: 'none',
                            borderRadius: '1rem',
                            padding: '3px 10px',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          ② Write Like Me
                        </button>

                        {/* Copy button */}
                        <button
                          type="button"
                          onClick={() => handleCopyText(msg.content, msg.id)}
                          title="Copy text"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: copiedId === msg.id ? '#10B981' : isDark ? '#9CA3AF' : 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '3px 6px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'color 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = isDark ? '#FFFFFF' : 'var(--text-primary)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = copiedId === msg.id ? '#10B981' : isDark ? '#9CA3AF' : 'var(--text-muted)';
                          }}
                        >
                          {copiedId === msg.id ? <FiCheck style={{ fontSize: '15px' }} /> : <FiCopy style={{ fontSize: '15px' }} />}
                        </button>

                        {/* Expand / Fullscreen button */}
                        <button
                          type="button"
                          onClick={() => setFullscreenMsgId(fullscreenMsgId === msg.id ? null : msg.id)}
                          title="Expand response view"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: isDark ? '#9CA3AF' : 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '3px 6px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'color 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = isDark ? '#FFFFFF' : 'var(--text-primary)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = isDark ? '#9CA3AF' : 'var(--text-muted)';
                          }}
                        >
                          <FiMaximize2 style={{ fontSize: '14px' }} />
                        </button>
                      </div>
                    </div>

                    {/* Message Content */}
                    <div
                      style={{
                        fontSize: '0.875rem',
                        lineHeight: 1.6,
                        color: isDark ? '#E6EDF3' : 'var(--text-primary)',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        fontWeight: 400,
                      }}
                    >
                      {msg.content}
                    </div>

                    {/* Footer Actions */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: '0.5rem',
                        borderTop: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid var(--border-color)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleAdoptPrompt(msg.content)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '3px 10px',
                          borderRadius: '1rem',
                          border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid var(--border-color)',
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'var(--bg-secondary)',
                          color: brandColor,
                          fontSize: '0.6875rem',
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        title="Save this output into prompt template"
                      >
                        <SparklesIcon size={11} color={brandColor} />
                        <span>Use as Prompt</span>
                      </button>

                      {msg.durationMs && (
                        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                          {(msg.durationMs / 1000).toFixed(1)}s
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Typing Indicator */}
            {isGenerating && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: isRunware
                      ? 'rgba(16,185,129,0.18)'
                      : isLaoZhang
                      ? 'rgba(37,99,235,0.15)'
                      : isGoogle
                      ? 'rgba(59,130,246,0.15)'
                      : 'rgba(16,185,129,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {isRunware ? (
                    <RunwareIcon size={14} />
                  ) : isLaoZhang ? (
                    <LaoZhangIcon size={14} />
                  ) : isGoogle ? (
                    <SiGooglegemini style={{ fontSize: '14px', color: '#60A5FA' }} />
                  ) : (
                    <OpenAIIcon size={14} color="#34D399" />
                  )}
                </div>
                <div
                  style={{
                    backgroundColor: isDark ? '#161B22' : 'var(--bg-surface)',
                    border: isDark ? 'none' : '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '0.5rem 0.875rem',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    fontWeight: 400,
                  }}
                >
                  {isRunware ? 'Runware AI is generating...' : isLaoZhang ? 'LaoZhang AI is generating...' : isGoogle ? 'Gemini is running prompt...' : 'ChatGPT is generating...'}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
            </div>
          </div>

          {/* CHAT INPUT BAR (Signature ChatGPT / Gemini style) */}
          <div
            style={{
              padding: '0.75rem 1.25rem 1.25rem 1.25rem',
              backgroundColor: isDark ? '#0D1117' : 'var(--bg-main)',
            }}
          >
            <div
              style={{
                width: isSettingsOpen ? '90%' : '70%',
                minWidth: '320px',
                margin: '0 auto',
                backgroundColor: isDark ? '#161B22' : 'var(--bg-surface)',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid var(--border-color)',
                borderRadius: '1rem',
                padding: '0.625rem 0.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.375rem',
                boxShadow: isDark ? '0 4px 12px rgba(0, 0, 0, 0.3)' : '0 2px 10px rgba(0, 0, 0, 0.05)',
                transition: 'width 0.2s ease',
              }}
            >
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isGoogle
                    ? 'Message Gemini... (Paste raw post or instruct changes)'
                    : 'Message ChatGPT... (Paste raw post or instruct changes)'
                }
                rows={1}
                disabled={isGenerating}
                style={{
                  width: '100%',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: isDark ? '#FFFFFF' : 'var(--text-primary)',
                  fontSize: '0.8125rem',
                  fontWeight: 400,
                  lineHeight: 1.5,
                  outline: 'none',
                  resize: 'none',
                  boxSizing: 'border-box',
                  minHeight: '24px',
                  maxHeight: '200px',
                  overflowY: 'hidden',
                }}
              />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                {isGenerating ? (
                  /* STOP BUTTON (Screenshot 5) */
                  <button
                    type="button"
                    onClick={handleStopGeneration}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: brandColor,
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                    }}
                    title="Stop generation"
                  >
                    <div
                      style={{
                        width: '10px',
                        height: '10px',
                        backgroundColor: '#FFFFFF',
                        borderRadius: '2px',
                      }}
                    />
                  </button>
                ) : (
                  /* SEND BUTTON (Screenshot 4) */
                  <button
                    type="button"
                    onClick={() => handleSendMessage()}
                    disabled={!inputValue.trim()}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: inputValue.trim()
                        ? brandColor
                        : (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)'),
                      border: 'none',
                      color: inputValue.trim() ? '#FFFFFF' : (isDark ? 'rgba(255, 255, 255, 0.4)' : 'var(--text-muted)'),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: inputValue.trim() ? 'pointer' : 'not-allowed',
                      transition: 'all 0.15s ease',
                    }}
                    title="Send message (Enter)"
                  >
                    <FiArrowUp style={{ fontSize: '16px' }} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* Fullscreen Modal View for Assistant Output */}
        {fullscreenMsgId && (() => {
          const fullMsg = messages.find((m) => m.id === fullscreenMsgId);
          if (!fullMsg) return null;
          return (
            <div
              ref={fullscreenModalRef}
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                backdropFilter: 'blur(4px)',
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2rem',
                overscrollBehavior: 'contain',
                touchAction: 'none',
              }}
              onWheel={(e) => e.stopPropagation()}
              onClick={() => setFullscreenMsgId(null)}
            >
              <div
                style={{
                  width: '800px',
                  maxWidth: '95vw',
                  maxHeight: '85vh',
                  backgroundColor: isDark ? '#1E1F22' : 'var(--bg-surface)',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid var(--border-color)',
                  borderRadius: '1.25rem',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: isDark ? '0 8px 32px rgba(0, 0, 0, 0.6)' : '0 8px 32px rgba(0, 0, 0, 0.15)',
                  overscrollBehavior: 'contain',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingBottom: '1rem',
                    borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid var(--border-color)',
                    marginBottom: '1rem',
                  }}
                >
                  <span style={{ fontSize: '1rem', fontWeight: 600, color: isDark ? '#FFFFFF' : 'var(--text-primary)' }}>
                    {box.title || 'Writing Output'}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => handleCopyText(fullMsg.content, fullMsg.id)}
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                        border: 'none',
                        color: isDark ? '#FFFFFF' : 'var(--text-primary)',
                        borderRadius: '8px',
                        padding: '6px 12px',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      {copiedId === fullMsg.id ? <FiCheck /> : <FiCopy />}
                      <span>{copiedId === fullMsg.id ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFullscreenMsgId(null)}
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                        border: 'none',
                        color: isDark ? '#FFFFFF' : 'var(--text-primary)',
                        borderRadius: '50%',
                        width: '30px',
                        height: '30px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <FiX style={{ fontSize: '16px' }} />
                    </button>
                  </div>
                </div>
                <div
                  className="chatbot-fullscreen-body"
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    overscrollBehavior: 'contain',
                    fontSize: '0.875rem',
                    lineHeight: 1.6,
                    color: isDark ? '#E6EDF3' : 'var(--text-primary)',
                    whiteSpace: 'pre-wrap',
                  }}
                  onWheel={(e) => e.stopPropagation()}
                >
                  {fullMsg.content}
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};
