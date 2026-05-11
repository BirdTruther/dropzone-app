'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface Props {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
}

const THRESHOLD = 72;   // px of pull needed to trigger
const MAX_PULL  = 100;  // px max visual stretch

export default function PullToRefresh({ onRefresh, children }: Props) {
  const [pullY, setPullY]       = useState(0);   // how far pulled (0-MAX_PULL)
  const [status, setStatus]     = useState<'idle' | 'pulling' | 'ready' | 'refreshing'>('idle');
  const startYRef               = useRef<number | null>(null);
  const containerRef            = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    // Only activate when at the very top of the page
    if (window.scrollY === 0) {
      startYRef.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (startYRef.current === null) return;
    if (window.scrollY > 0) { startYRef.current = null; return; }
    const delta = e.touches[0].clientY - startYRef.current;
    if (delta <= 0) return;
    // Rubber-band resistance: pull feels progressively harder
    const resistance = Math.min(delta * 0.45, MAX_PULL);
    setPullY(resistance);
    setStatus(resistance >= THRESHOLD * 0.45 ? 'ready' : 'pulling');
  }, []);

  const handleTouchEnd = useCallback(async () => {
    if (startYRef.current === null) return;
    startYRef.current = null;
    if (pullY >= THRESHOLD * 0.45) {
      setStatus('refreshing');
      setPullY(48); // snap to spinner position
      await onRefresh();
    }
    setPullY(0);
    setStatus('idle');
  }, [pullY, onRefresh]);

  useEffect(() => {
    const el = document.documentElement;
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove',  handleTouchMove,  { passive: true });
    el.addEventListener('touchend',   handleTouchEnd,   { passive: true });
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove',  handleTouchMove);
      el.removeEventListener('touchend',   handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const isActive  = status !== 'idle';
  const spinnerY  = Math.max(0, pullY - 8);
  const opacity   = Math.min(pullY / (THRESHOLD * 0.45), 1);
  const scale     = 0.6 + 0.4 * Math.min(pullY / (THRESHOLD * 0.45), 1);
  const isReady   = status === 'ready' || status === 'refreshing';

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Pull indicator */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          pointerEvents: 'none',
          height: 0,
          overflow: 'visible',
          zIndex: 10,
        }}
      >
        <div
          style={{
            transform: `translateY(${spinnerY}px) scale(${scale})`,
            opacity: isActive ? opacity : 0,
            transition: status === 'idle' ? 'opacity 200ms ease, transform 200ms ease' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          }}
        >
          {status === 'refreshing' ? (
            /* Spinning ring */
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'ptr-spin 0.7s linear infinite', color: 'var(--color-text-muted)' }}>
              <style>{`@keyframes ptr-spin { to { transform: rotate(360deg); } }`}</style>
              <path d="M12 2a10 10 0 0 1 10 10" />
            </svg>
          ) : (
            /* Arrow — rotates when ready to release */
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: isReady ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms ease', color: isReady ? 'var(--color-accent, #5b6af7)' : 'var(--color-text-muted)' }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          )}
        </div>
      </div>

      {/* Content pushed down while pulling */}
      <div
        style={{
          transform: isActive ? `translateY(${pullY}px)` : 'none',
          transition: status === 'idle' ? 'transform 250ms cubic-bezier(0.16,1,0.3,1)' : 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
}
