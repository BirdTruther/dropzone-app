'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import PushNotificationToggle from '@/components/PushNotificationToggle';
import NotificationPreferences from '@/components/NotificationPreferences';

type SectionKey = 'profile' | 'password' | 'notifications' | 'delete';

export default function ProfilePage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const user = session?.user as { name?: string | null; email?: string | null; image?: string | null } | undefined;

  const [activeSection, setActiveSection] = useState<SectionKey>('profile');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [avatar, setAvatar] = useState('');
  const [profileMsg, setProfileMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [deletePassword, setDeletePassword] = useState('');
  const [deleteMsg, setDeleteMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    if (user) {
      setName(user.name ?? '');
      setEmail(user.email ?? '');
      setAvatar(user.image ?? '');
    }
  }, [user]);

  if (status === 'loading') {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}><p style={{ color: 'var(--color-text-muted)' }}>Loading...</p></div>;
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileLoading(true);
    setProfileMsg(null);
    const res = await fetch('/api/user', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, avatar }),
    });
    const data = await res.json();
    setProfileLoading(false);
    if (!res.ok) return setProfileMsg({ type: 'err', text: data.error ?? 'Something went wrong' });
    await update({ name: data.name, email: data.email, image: data.avatar });
    setProfileMsg({ type: 'ok', text: 'Profile updated!' });
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) return setPasswordMsg({ type: 'err', text: 'New passwords do not match' });
    if (newPassword.length < 8) return setPasswordMsg({ type: 'err', text: 'Password must be at least 8 characters' });
    setPasswordLoading(true);
    setPasswordMsg(null);
    const res = await fetch('/api/user', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    setPasswordLoading(false);
    if (!res.ok) return setPasswordMsg({ type: 'err', text: data.error ?? 'Something went wrong' });
    setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    setPasswordMsg({ type: 'ok', text: 'Password changed successfully!' });
  }

  async function deleteAccount(e: React.FormEvent) {
    e.preventDefault();
    setDeleteLoading(true);
    setDeleteMsg(null);
    const res = await fetch('/api/user', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: deletePassword }),
    });
    const data = await res.json();
    setDeleteLoading(false);
    if (!res.ok) return setDeleteMsg({ type: 'err', text: data.error ?? 'Something went wrong' });
    await signOut({ callbackUrl: '/login' });
  }

  const tabStyle = (key: SectionKey) => ({
    padding: '0.5rem 1rem',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.875rem',
    fontWeight: 500,
    cursor: 'pointer',
    background: activeSection === key ? 'var(--color-surface-2)' : 'transparent',
    color: activeSection === key ? 'var(--color-text)' : 'var(--color-text-muted)',
    border: 'none',
    transition: 'background 0.15s, color 0.15s',
  } as React.CSSProperties);

  const msgStyle = (type: 'ok' | 'err') => ({
    padding: '0.6rem 0.9rem',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.875rem',
    background: type === 'ok' ? 'rgba(91,106,247,0.12)' : 'rgba(224,92,92,0.12)',
    color: type === 'ok' ? 'var(--color-accent)' : 'var(--color-danger)',
    marginTop: '0.75rem',
  } as React.CSSProperties);

  return (
    <div style={{ maxWidth: '560px', margin: '2.5rem auto', padding: '0 1rem' }}>

      {/* Avatar + name header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        {avatar ? (
          <img src={avatar} alt={name} width={64} height={64} style={{ borderRadius: '50%', objectFit: 'cover' }} />
        ) : (
          <span style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'var(--color-accent)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.5rem', fontWeight: 700, color: '#fff', flexShrink: 0,
          }}>
            {(name || 'U')[0].toUpperCase()}
          </span>
        )}
        <div>
          <p style={{ fontWeight: 600, fontSize: '1.1rem' }}>{name || 'Your Profile'}</p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{email}</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem', flexWrap: 'wrap' }}>
        <button style={tabStyle('profile')} onClick={() => setActiveSection('profile')}>Profile</button>
        <button style={tabStyle('password')} onClick={() => setActiveSection('password')}>Password</button>
        <button style={tabStyle('notifications')} onClick={() => setActiveSection('notifications')}>Notifications</button>
        <button style={tabStyle('delete')} onClick={() => setActiveSection('delete')}>Delete Account</button>
      </div>

      {/* Profile Section */}
      {activeSection === 'profile' && (
        <form onSubmit={saveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.4rem' }}>Display Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" required />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.4rem' }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.4rem' }}>Avatar URL <span style={{ opacity: 0.5 }}>(optional)</span></label>
            <input value={avatar} onChange={e => setAvatar(e.target.value)} placeholder="https://..." />
          </div>
          {profileMsg && <div style={msgStyle(profileMsg.type)}>{profileMsg.text}</div>}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
            <button type="submit" className="btn btn-primary" disabled={profileLoading}>
              {profileLoading ? 'Saving...' : 'Save Changes'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => signOut({ callbackUrl: '/login' })}>Sign Out</button>
          </div>
        </form>
      )}

      {/* Password Section */}
      {activeSection === 'password' && (
        <form onSubmit={savePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.4rem' }}>Current Password</label>
            <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.4rem' }}>New Password</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min 8 characters" required />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.4rem' }}>Confirm New Password</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          {passwordMsg && <div style={msgStyle(passwordMsg.type)}>{passwordMsg.text}</div>}
          <button type="submit" className="btn btn-primary" style={{ marginTop: '0.25rem' }} disabled={passwordLoading}>
            {passwordLoading ? 'Updating...' : 'Change Password'}
          </button>
        </form>
      )}

      {/* Notifications Section */}
      {activeSection === 'notifications' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <p style={{ fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
            Push Device
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
            Enable push notifications to get alerted even when dropzone isn't open.
          </p>
          <PushNotificationToggle />
          <NotificationPreferences />
        </div>
      )}

      {/* Delete Account Section */}
      {activeSection === 'delete' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card" style={{ borderColor: 'rgba(224,92,92,0.3)' }}>
            <p style={{ fontWeight: 600, color: 'var(--color-danger)', marginBottom: '0.5rem' }}>⚠️ Delete Account</p>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
              This will permanently delete your account, all your posts, reactions, and group memberships. This cannot be undone.
            </p>
          </div>
          {!deleteConfirm ? (
            <button className="btn btn-ghost" style={{ borderColor: 'rgba(224,92,92,0.4)', color: 'var(--color-danger)' }} onClick={() => setDeleteConfirm(true)}>
              I want to delete my account
            </button>
          ) : (
            <form onSubmit={deleteAccount} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.4rem' }}>Confirm your password to continue</label>
                <input type="password" value={deletePassword} onChange={e => setDeletePassword(e.target.value)} placeholder="••••••••" required />
              </div>
              {deleteMsg && <div style={msgStyle(deleteMsg.type)}>{deleteMsg.text}</div>}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="submit" className="btn" style={{ background: 'var(--color-danger)', color: '#fff' }} disabled={deleteLoading}>
                  {deleteLoading ? 'Deleting...' : 'Permanently Delete'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => { setDeleteConfirm(false); setDeletePassword(''); }}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
