'use client';
import { useEffect, useState } from 'react';
import { PUSH_MIGRATION_FLAG } from '@/components/PushInit';

/**
 * Shown once to devices that had push notifications set up before the VAPID
 * keypair was rotated. PushInit sets PUSH_MIGRATION_FLAG in localStorage when
 * it detects and silently re-subscribes a stale subscription — this banner
 * just confirms that happened, since it's otherwise invisible to the user.
 * New users who never had push enabled never see this.
 */
export default function PushMigrationBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(PUSH_MIGRATION_FLAG)) setVisible(true);
    } catch { /* private browsing / storage disabled */ }
  }, []);

  function dismiss() {
    setVisible(false);
    try { localStorage.removeItem(PUSH_MIGRATION_FLAG); } catch { /* non-fatal */ }
  }

  if (!visible) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
      padding: '0.6rem 1rem', fontSize: '0.82rem',
      background: 'rgba(91,106,247,0.12)', color: 'var(--color-accent, #5b6af7)',
      borderBottom: '1px solid var(--color-border)', textAlign: 'center',
    }}>
      <span>
        🔔 We reset push notifications for security — yours have been reactivated automatically.
        If they don&apos;t come through, re-enable them from Profile.
      </span>
      <button onClick={dismiss} aria-label="Dismiss"
        style={{ flexShrink: 0, color: 'inherit', fontSize: '1rem', lineHeight: 1, padding: '0.15rem', opacity: 0.7 }}>
        ✕
      </button>
    </div>
  );
}
