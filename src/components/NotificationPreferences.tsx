'use client';

import { useState, useEffect } from 'react';

type Prefs = {
  notifyPushNewDrop: boolean;
  notifyPushReaction: boolean;
  notifyPushComment: boolean;
  notifyPushMention: boolean;
  notifyInAppNewDrop: boolean;
  notifyInAppReaction: boolean;
  notifyInAppComment: boolean;
  notifyInAppMention: boolean;
};

const EVENTS: { label: string; pushKey: keyof Prefs; inAppKey: keyof Prefs }[] = [
  { label: 'New drop in group',     pushKey: 'notifyPushNewDrop',   inAppKey: 'notifyInAppNewDrop'   },
  { label: 'Reaction on your post', pushKey: 'notifyPushReaction',  inAppKey: 'notifyInAppReaction'  },
  { label: 'Comment on your post',  pushKey: 'notifyPushComment',   inAppKey: 'notifyInAppComment'   },
  { label: 'Mention in a comment',  pushKey: 'notifyPushMention',   inAppKey: 'notifyInAppMention'   },
];

export default function NotificationPreferences() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/user')
      .then(r => r.ok ? r.json() : null)
      .then(data => data && setPrefs(data))
      .catch(() => {});
  }, []);

  async function toggle(key: keyof Prefs) {
    if (!prefs) return;
    const newVal = !prefs[key];
    setPrefs(p => p ? { ...p, [key]: newVal } : p);
    setSaving(key);
    await fetch('/api/user', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: newVal }),
    });
    setSaving(null);
    setSavedKey(key);
    setTimeout(() => setSavedKey(k => k === key ? null : k), 1500);
  }

  if (!prefs) return <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', padding: '0.5rem 0' }}>Loading preferences…</div>;

  return (
    <div style={{ marginTop: '1.25rem' }}>
      <p style={{ fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
        Notification Types
      </p>

      {/* Column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 56px 56px', gap: '0.25rem', marginBottom: '0.4rem', paddingRight: '0.25rem' }}>
        <span />
        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textAlign: 'center', fontWeight: 600 }}>Push</span>
        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textAlign: 'center', fontWeight: 600 }}>In-App</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
        {EVENTS.map(({ label, pushKey, inAppKey }) => (
          <div key={label} style={{
            display: 'grid', gridTemplateColumns: '1fr 56px 56px',
            alignItems: 'center', gap: '0.25rem',
            padding: '0.55rem 0.25rem',
            borderRadius: 'var(--radius-sm)',
            borderBottom: '1px solid var(--color-border)',
          }}>
            <span style={{ fontSize: '0.875rem' }}>{label}</span>

            {([pushKey, inAppKey] as (keyof Prefs)[]).map(key => {
              const on = prefs[key];
              const isSaving = saving === key;
              const justSaved = savedKey === key;
              return (
                <div key={key} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <button
                    onClick={() => toggle(key)}
                    disabled={isSaving}
                    aria-label={`${on ? 'Disable' : 'Enable'} ${key}`}
                    aria-checked={on}
                    role="switch"
                    style={{
                      width: 36, height: 20, borderRadius: 10,
                      background: on ? 'var(--color-accent, #5b6af7)' : 'var(--color-border)',
                      border: 'none', cursor: isSaving ? 'default' : 'pointer',
                      position: 'relative', transition: 'background 0.18s',
                      opacity: isSaving ? 0.6 : 1, flexShrink: 0,
                    }}
                  >
                    <span style={{
                      position: 'absolute', top: 3, left: on ? 19 : 3,
                      width: 14, height: 14, borderRadius: '50%',
                      background: '#fff', transition: 'left 0.18s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }} />
                  </button>
                  {justSaved && <span style={{ fontSize: '0.65rem', color: 'var(--color-success, #22c55e)', marginLeft: 4 }}>✓</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
