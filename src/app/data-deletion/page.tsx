export default function DataDeletionPage() {
  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '2rem 1rem', lineHeight: 1.7 }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Data Deletion Request</h1>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '2rem' }}>Last updated: May 2026</p>

      <p>Dropzone is a private self-hosted application. We do not store any Facebook account data or use Facebook Login.</p>

      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '1.5rem', marginBottom: '0.5rem' }}>How to Delete Your Data</h2>
      <p>If you would like to delete your Dropzone account and all associated data (name, email, posts, reactions), you can do so in one of the following ways:</p>
      <ul style={{ paddingLeft: '1.25rem', marginTop: '0.5rem', marginBottom: '1rem' }}>
        <li>Log into Dropzone and delete your account from your profile settings</li>
        <li>Contact the app administrator directly and request deletion</li>
      </ul>

      <p>Upon request, all of your personal data will be permanently deleted from our servers within <strong>30 days</strong>.</p>

      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '1.5rem', marginBottom: '0.5rem' }}>Contact</h2>
      <p>This is a private self-hosted application. For deletion requests, contact the administrator directly.</p>
    </div>
  );
}
