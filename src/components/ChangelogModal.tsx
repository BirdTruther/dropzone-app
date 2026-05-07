'use client';
import { useEffect, useState } from 'react';

interface Release {
  version: string;
  date: string;
  items: string[];
}

export default function ChangelogModal() {
  const [open, setOpen] = useState(false);
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasNew, setHasNew] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (releases.length > 0) return;
    setLoading(true);
    fetch('/api/changelog')
      .then(r => r.json())
      .then(data => {
        setReleases(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [open]);

  // Show "new" dot if latest version hasn't been seen
  useEffect(() => {
    fetch('/api/changelog')
      .then(r => r.json())
      .then((data: Release[]) => {
        if (!data.length) return;
        const latest = data[0].version;
        const seen = sessionStorage.getItem('seen_changelog');
        if (seen !== latest) setHasNew(true);
      })
      .catch(() => {});
  }, []);

  function openModal() {
    setOpen(true);
    if (releases.length > 0) {
      sessionStorage.setItem('seen_changelog', releases[0].version);
      setHasNew(false);
    }
  }

  useEffect(() => {
    if (open && releases.length > 0) {
      sessionStorage.setItem('seen_changelog', releases[0].version);
      setHasNew(false);
    }
  }, [open, releases]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        onClick={openModal}
        style={{
          position: 'relative',
          background: 'none',
          border: 'none',
          color: 'var(--color-text-muted)',
          fontSize: '0.75rem',
          cursor: 'pointer',
          padding: '0.25rem 0.5rem',
          borderRadius: 'var(--radius-sm)',
          transition: 'color 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-muted)')}
      >
        What&apos;s new
        {hasNew && (
          <span style={{
            position: 'absolute',
            top: 2,
            right: 2,
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'var(--color-accent, #5b6af7)',
            display: 'block',
          }} />
        )}
      </button>

      {open && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
            padding: '1rem',
          }}
        >
          <div style={{
            width: '100%', maxWidth: 520,
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-xl) var(--radius-xl) var(--radius-lg) var(--radius-lg)',
            border: '1px solid var(--color-border)',
            overflow: 'hidden',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideUp 0.2s cubic-bezier(0.16,1,0.3,1)',
          }}>
            <style>{`@keyframes slideUp { from { transform: translateY(32px); opacity: 0; } to { transform: none; opacity: 1; } }`}</style>

            {/* Modal header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-border)' }}>
              <div>
                <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.1rem' }}>What&apos;s New</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Dropzone update history</p>
              </div>
              <button onClick={() => setOpen(false)} style={{ color: 'var(--color-text-muted)', fontSize: '1.2rem', lineHeight: 1, padding: '0.25rem' }}>✕</button>
            </div>

            {/* Scrollable content */}
            <div style={{ overflowY: 'auto', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {loading && (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', textAlign: 'center', padding: '2rem 0' }}>Loading...</p>
              )}
              {!loading && releases.length === 0 && (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', textAlign: 'center', padding: '2rem 0' }}>No updates yet.</p>
              )}
              {releases.map((release, i) => (
                <div key={release.version}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.04em',
                      padding: '0.2rem 0.55rem', borderRadius: 'var(--radius-full)',
                      background: i === 0 ? 'var(--color-accent, #5b6af7)' : 'var(--color-surface-2)',
                      color: i === 0 ? '#fff' : 'var(--color-text-muted)',
                    }}>
                      {release.version}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{release.date}</span>
                    {i === 0 && <span style={{ fontSize: '0.7rem', color: 'var(--color-accent, #5b6af7)', fontWeight: 600 }}>Latest</span>}
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {release.items.map((item, j) => (
                      <li key={j} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--color-text)' }}>
                        <span style={{ color: 'var(--color-accent, #5b6af7)', flexShrink: 0, marginTop: '0.05rem' }}>•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
