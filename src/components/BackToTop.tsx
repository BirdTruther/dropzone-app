'use client';

import { useEffect, useState, useCallback } from 'react';

const SCROLL_THRESHOLD = 400;

export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  const onScroll = useCallback(() => {
    setVisible(window.scrollY > SCROLL_THRESHOLD);
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [onScroll]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <style>{`
        .back-to-top {
          position: fixed;
          bottom: calc(1.5rem + env(safe-area-inset-bottom, 0px));
          right: 1.5rem;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 2.75rem;
          height: 2.75rem;
          border-radius: 50%;
          background: var(--color-surface-2);
          color: var(--color-text);
          border: 1px solid var(--color-border);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
          cursor: pointer;
          opacity: 0;
          pointer-events: none;
          transform: translateY(0.75rem);
          transition: opacity 220ms ease, transform 220ms ease, background 150ms ease;
        }
        .back-to-top.visible {
          opacity: 1;
          pointer-events: auto;
          transform: translateY(0);
        }
        .back-to-top:hover {
          background: var(--color-accent);
          color: #fff;
          border-color: var(--color-accent);
        }
        .back-to-top:active {
          transform: scale(0.93);
        }
        @media (prefers-reduced-motion: reduce) {
          .back-to-top {
            transition: opacity 220ms ease;
            transform: none !important;
          }
        }
        @media (max-width: 480px) {
          .back-to-top {
            bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
            right: 1rem;
            width: 2.5rem;
            height: 2.5rem;
          }
        }
      `}</style>
      <button
        onClick={scrollToTop}
        aria-label="Back to top"
        className={`back-to-top${visible ? ' visible' : ''}`}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>
    </>
  );
}
