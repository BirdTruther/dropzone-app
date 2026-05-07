export default function ForgotPasswordPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="card" style={{ width: '100%', maxWidth: 420, padding: '2rem', textAlign: 'center' }}>
        <p style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔒</p>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Locked out?</h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
          Dropzone doesn&apos;t send password reset emails automatically. To reset your password,
          reach out to your server admin and they can set a new one for you from the admin panel.
        </p>
        <div style={{
          background: 'var(--color-surface-2)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          fontSize: '0.875rem',
          color: 'var(--color-text-muted)',
          lineHeight: 1.6,
        }}>
          <strong style={{ color: 'var(--color-text)', display: 'block', marginBottom: '0.25rem' }}>What to tell the admin:</strong>
          Your account email address and a request to reset your password.
          They&apos;ll set a temporary password so you can sign back in.
        </div>
        <a
          href="/login"
          style={{
            display: 'inline-block',
            padding: '0.5rem 1.5rem',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--color-accent, #5b6af7)',
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.875rem',
            textDecoration: 'none',
          }}
        >
          Back to Sign In
        </a>
      </div>
    </div>
  );
}
