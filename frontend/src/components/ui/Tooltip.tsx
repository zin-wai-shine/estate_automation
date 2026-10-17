import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  position?: TooltipPosition;
  delay?: number;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

interface TooltipCoords {
  top: number;
  left: number;
  actualPosition: TooltipPosition;
  arrowLeft?: number;
  arrowTop?: number;
}

/**
 * Calculates the coordinates of a tooltip relative to the viewport.
 * Automatically flips or adjusts position if near the edge of the window.
 */
function calculateCoords(
  rect: DOMRect,
  tooltipWidth: number,
  tooltipHeight: number,
  preferredPos: TooltipPosition = 'top',
  offset = 8
): TooltipCoords {
  const vWidth = window.innerWidth;
  const vHeight = window.innerHeight;
  let pos = preferredPos;

  // Collision checks & auto flip
  if (pos === 'top' && rect.top - tooltipHeight - offset < 4) {
    pos = 'bottom';
  } else if (pos === 'bottom' && rect.bottom + tooltipHeight + offset > vHeight - 4) {
    pos = 'top';
  } else if (pos === 'left' && rect.left - tooltipWidth - offset < 4) {
    pos = 'right';
  } else if (pos === 'right' && rect.right + tooltipWidth + offset > vWidth - 4) {
    pos = 'left';
  }

  let top = 0;
  let left = 0;

  switch (pos) {
    case 'top':
      top = rect.top - tooltipHeight - offset;
      left = rect.left + rect.width / 2 - tooltipWidth / 2;
      break;
    case 'bottom':
      top = rect.bottom + offset;
      left = rect.left + rect.width / 2 - tooltipWidth / 2;
      break;
    case 'left':
      top = rect.top + rect.height / 2 - tooltipHeight / 2;
      left = rect.left - tooltipWidth - offset;
      break;
    case 'right':
      top = rect.top + rect.height / 2 - tooltipHeight / 2;
      left = rect.right + offset;
      break;
  }

  // Horizontal clamping (with 8px viewport padding)
  const minLeft = 8;
  const maxLeft = vWidth - tooltipWidth - 8;
  const clampedLeft = Math.max(minLeft, Math.min(left, maxLeft));

  // Calculate arrow position relative to the tooltip box
  const targetCenterX = rect.left + rect.width / 2;
  const arrowLeft = Math.max(10, Math.min(tooltipWidth - 10, targetCenterX - clampedLeft));

  return {
    top: Math.round(top),
    left: Math.round(clampedLeft),
    actualPosition: pos,
    arrowLeft: Math.round(arrowLeft),
  };
}

/**
 * Tooltip container style & animation
 */
const getTooltipStyles = (coords: TooltipCoords | null, customStyle?: React.CSSProperties): React.CSSProperties => {
  const isReady = Boolean(coords);
  const pos = coords?.actualPosition || 'top';

  let translateY = '0px';
  let translateX = '0px';
  if (pos === 'top') translateY = '-2px';
  else if (pos === 'bottom') translateY = '2px';
  else if (pos === 'left') translateX = '-2px';
  else if (pos === 'right') translateX = '2px';

  return {
    position: 'fixed',
    top: coords ? coords.top : -9999,
    left: coords ? coords.left : -9999,
    zIndex: 9999999,
    pointerEvents: 'none',
    opacity: isReady ? 1 : 0,
    transform: isReady ? `translate3d(${translateX}, ${translateY}, 0) scale(1)` : 'scale(0.96)',
    transition: 'opacity 0.14s cubic-bezier(0.16, 1, 0.3, 1), transform 0.14s cubic-bezier(0.16, 1, 0.3, 1)',
    backgroundColor: '#1E1E22',
    color: '#F4F4F5',
    border: '1px solid rgba(255, 255, 255, 0.13)',
    borderRadius: '6px',
    padding: '4px 8px',
    fontSize: '11px',
    fontWeight: 500,
    lineHeight: 1.35,
    letterSpacing: '0.012em',
    whiteSpace: 'nowrap',
    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35), 0 1px 3px rgba(0, 0, 0, 0.2)',
    backdropFilter: 'blur(8px)',
    userSelect: 'none',
    ...customStyle,
  };
};

/**
 * Professional, modern Tooltip wrapper component.
 * Uses a portal so it never gets clipped by parent overflow: hidden or modals.
 */
export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delay = 140,
  disabled = false,
  className = '',
  style,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState<TooltipCoords | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<any>(null);

  const show = () => {
    if (disabled || !content) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (triggerRef.current) {
        setIsVisible(true);
      }
    }, delay);
  };

  const hide = () => {
    clearTimeout(timerRef.current);
    setIsVisible(false);
  };

  useLayoutEffect(() => {
    if (isVisible && triggerRef.current && tooltipRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const tRect = tooltipRef.current.getBoundingClientRect();
      setCoords(calculateCoords(rect, tRect.width, tRect.height, position));
    }
  }, [isVisible, position, content]);

  useEffect(() => {
    if (!isVisible) return;
    const handleScrollOrResize = () => hide();
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isVisible]);

  const child = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<any>, {
        ref: (node: HTMLElement | null) => {
          triggerRef.current = node;
          const originalRef = (children as any).ref;
          if (typeof originalRef === 'function') originalRef(node);
          else if (originalRef) originalRef.current = node;
        },
        onMouseEnter: (e: React.MouseEvent) => {
          (children as any).props?.onMouseEnter?.(e);
          show();
        },
        onMouseLeave: (e: React.MouseEvent) => {
          (children as any).props?.onMouseLeave?.(e);
          hide();
        },
        onClick: (e: React.MouseEvent) => {
          (children as any).props?.onClick?.(e);
          hide();
        },
        onFocus: (e: React.FocusEvent) => {
          (children as any).props?.onFocus?.(e);
          show();
        },
        onBlur: (e: React.FocusEvent) => {
          (children as any).props?.onBlur?.(e);
          hide();
        },
      })
    : children;

  return (
    <>
      {child}
      {isVisible &&
        content &&
        createPortal(
          <div
            ref={tooltipRef}
            role="tooltip"
            className={`ea-custom-tooltip ${className}`}
            style={getTooltipStyles(coords, style)}
          >
            {content}
          </div>,
          document.body
        )}
    </>
  );
};

/**
 * Global Tooltip Listener.
 * - Automatically listens to elements with `data-tooltip="..."` or intercepts native `title="..."` attributes.
 * - Displays a sleek, professional, modern tooltip without default browser styling.
 */
export const GlobalTooltip: React.FC = () => {
  const [activeData, setActiveData] = useState<{
    text: string;
    target: HTMLElement;
    position: TooltipPosition;
  } | null>(null);

  const [coords, setCoords] = useState<TooltipCoords | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const hoverTimerRef = useRef<any>(null);
  const isAnyTooltipOpenRef = useRef(false);

  useEffect(() => {
    const handleMouseOver = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest?.('[data-no-tooltip="true"], [data-no-tooltip]')) return;

      const target = el?.closest?.('[data-tooltip], [title]') as HTMLElement | null;
      if (!target) return;

      // If element has a native title, capture it and remove the native attribute
      // so the browser's ugly default tooltip is permanently suppressed.
      if (target.hasAttribute('title')) {
        const titleText = target.getAttribute('title')?.trim();
        if (titleText) {
          target.setAttribute('data-tooltip', titleText);
        }
        target.removeAttribute('title');
      }

      const text = target.getAttribute('data-tooltip')?.trim();
      if (!text) return;

      // Don't re-trigger if already on the same target
      if (activeData?.target === target) {
        return;
      }

      const pos = (target.getAttribute('data-tooltip-position') as TooltipPosition) || 'top';
      const delay = isAnyTooltipOpenRef.current ? 20 : 120;

      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = setTimeout(() => {
        isAnyTooltipOpenRef.current = true;
        setActiveData({ text, target, position: pos });
      }, delay);
    };

    const handleMouseOut = (e: MouseEvent) => {
      const related = e.relatedTarget as Node | null;
      // If moving within the same target or its children, do not hide
      if (activeData?.target && related && activeData.target.contains(related)) {
        return;
      }

      clearTimeout(hoverTimerRef.current);
      // Give a tiny grace period so fast transitions between items feel instant
      hoverTimerRef.current = setTimeout(() => {
        isAnyTooltipOpenRef.current = false;
        setActiveData(null);
        setCoords(null);
      }, 50);
    };

    const handleMouseDown = () => {
      clearTimeout(hoverTimerRef.current);
      isAnyTooltipOpenRef.current = false;
      setActiveData(null);
      setCoords(null);
    };

    const handleScrollOrResize = () => {
      clearTimeout(hoverTimerRef.current);
      isAnyTooltipOpenRef.current = false;
      setActiveData(null);
      setCoords(null);
    };

    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('mouseout', handleMouseOut, true);
    document.addEventListener('mousedown', handleMouseDown, true);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      clearTimeout(hoverTimerRef.current);
      document.removeEventListener('mouseover', handleMouseOver, true);
      document.removeEventListener('mouseout', handleMouseOut, true);
      document.removeEventListener('mousedown', handleMouseDown, true);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [activeData?.target]);

  useLayoutEffect(() => {
    if (activeData && tooltipRef.current) {
      const rect = activeData.target.getBoundingClientRect();
      const tRect = tooltipRef.current.getBoundingClientRect();
      setCoords(calculateCoords(rect, tRect.width, tRect.height, activeData.position));
    } else {
      setCoords(null);
    }
  }, [activeData]);

  if (!activeData) return null;

  return createPortal(
    <div
      ref={tooltipRef}
      role="tooltip"
      className="ea-custom-tooltip"
      style={getTooltipStyles(coords)}
    >
      {activeData.text}
    </div>,
    document.body
  );
};
