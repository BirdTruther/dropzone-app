'use client';
import { useEffect, useCallback } from 'react';

interface LightboxProps {
  src: string;
  alt?: string;
  onClose: () => void;
}

export default function Lightbox({ src, alt, onClose }: LightboxProps) {
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [handleKey]);

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt ?? 'Image lightbox'}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.92)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'zoom-out',
        animation: 'lbFadeIn 0.15s ease',
      }}
    >
      <style>{`
        @keyframes lbFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes lbZoomIn { from { transform: scale(0.92); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
      <button
        onClick={onClose}
        aria-label="Close lightbox"
        style={{
          position: 'absolute', top: 16, right: 16,
          background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff',
          width: 40, height: 40, borderRadius: '50%', fontSize: '1.2rem',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)', zIndex: 201,
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.22)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
      >
        ✕
      </button>
      <img
        src={src}
        alt={alt ?? ''}
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: 'min(92vw, 1200px)',
          maxHeight: '90vh',
          objectFit: 'contain',
          borderRadius: 8,
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          cursor: 'default',
          animation: 'lbZoomIn 0.18s cubic-bezier(0.16,1,0.3,1)',
        }}
      />
    </div>
  );
}
