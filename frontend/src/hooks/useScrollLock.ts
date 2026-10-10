import { useEffect, useRef } from 'react';

let activeScrollLocks = 0;
let savedBodyOverflow = '';
let savedHtmlOverflow = '';
let savedBodyOverscroll = '';
let savedHtmlOverscroll = '';

export interface ScrollLockOptions {
  containerRef?: React.RefObject<HTMLElement | null>;
  onWheel?: (e: WheelEvent) => void;
}

/**
 * Universal scroll lock & scroll-chaining prevention hook for modals and lightboxes.
 * Completely isolates the underlying page and background containers from wheel/touch scroll bleeding.
 */
export function useScrollLock(
  isLocked: boolean,
  options?: ScrollLockOptions
) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!isLocked) return;

    if (activeScrollLocks === 0) {
      savedBodyOverflow = document.body.style.overflow;
      savedHtmlOverflow = document.documentElement.style.overflow;
      savedBodyOverscroll = document.body.style.overscrollBehavior;
      savedHtmlOverscroll = document.documentElement.style.overscrollBehavior;

      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overscrollBehavior = 'none';
      document.documentElement.style.overscrollBehavior = 'none';
    }
    activeScrollLocks++;

    const handleWheel = (e: WheelEvent) => {
      // If a custom wheel handler is provided (e.g. for image lightbox zooming)
      if (optionsRef.current?.onWheel) {
        e.preventDefault();
        e.stopPropagation();
        optionsRef.current.onWheel(e);
        return;
      }

      const container = optionsRef.current?.containerRef?.current;
      const target = e.target as HTMLElement | null;

      // If wheel target is outside this modal's container: block completely
      if (container && target && !container.contains(target)) {
        e.preventDefault();
        return;
      }

      // Find nearest scrollable container between target and modal container
      let scrollable: HTMLElement | null = null;
      let curr = target;
      while (curr && curr !== container && curr !== document.body) {
        const style = window.getComputedStyle(curr);
        const canScroll =
          (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
          curr.scrollHeight > curr.clientHeight;
        if (canScroll) {
          scrollable = curr;
          break;
        }
        curr = curr.parentElement;
      }

      // No scrollable container under cursor (e.g. header, backdrop, or static modal body): block wheel
      if (!scrollable) {
        e.preventDefault();
        return;
      }

      // If scrollable element exists, check boundaries to prevent momentum / overscroll chaining
      const { scrollTop, scrollHeight, clientHeight } = scrollable;
      const deltaY = e.deltaY;

      if (deltaY < 0 && scrollTop <= 0) {
        // Reached top boundary and attempting to scroll up
        e.preventDefault();
        return;
      }

      if (deltaY > 0 && scrollTop + clientHeight >= scrollHeight - 1) {
        // Reached bottom boundary and attempting to scroll down
        e.preventDefault();
        return;
      }

      // Within valid scroll limits: allow smooth internal scrolling
    };

    const handleTouchMove = (e: TouchEvent) => {
      const container = optionsRef.current?.containerRef?.current;
      const target = e.target as HTMLElement | null;

      if (container && target && !container.contains(target)) {
        e.preventDefault();
        return;
      }

      let scrollable: HTMLElement | null = null;
      let curr = target;
      while (curr && curr !== container && curr !== document.body) {
        const style = window.getComputedStyle(curr);
        const canScroll =
          (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
          curr.scrollHeight > curr.clientHeight;
        if (canScroll) {
          scrollable = curr;
          break;
        }
        curr = curr.parentElement;
      }

      if (!scrollable) {
        e.preventDefault();
      }
    };

    // Use capturing phase so we intercept before ANY child element or background container
    window.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true });

    return () => {
      window.removeEventListener('wheel', handleWheel, { capture: true });
      window.removeEventListener('touchmove', handleTouchMove, { capture: true });

      activeScrollLocks = Math.max(0, activeScrollLocks - 1);
      if (activeScrollLocks === 0) {
        document.body.style.overflow = savedBodyOverflow;
        document.documentElement.style.overflow = savedHtmlOverflow;
        document.body.style.overscrollBehavior = savedBodyOverscroll;
        document.documentElement.style.overscrollBehavior = savedHtmlOverscroll;
      }
    };
  }, [isLocked]);
}
