export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '2rem 1rem', lineHeight: 1.7 }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Privacy Policy</h1>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '2rem' }}>Last updated: May 2026</p>

      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '1.5rem', marginBottom: '0.5rem' }}>What is Dropzone?</h2>
      <p>Dropzone is a private link-sharing app for small groups of friends and couples. It allows users to share links, videos, and media in a shared group feed.</p>

      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '1.5rem', marginBottom: '0.5rem' }}>Information We Collect</h2>
      <p>We collect only the information you provide when creating an account:</p>
      <ul style={{ paddingLeft: '1.25rem', marginTop: '0.5rem' }}>
        <li>Name</li>
        <li>Email address</li>
        <li>Password (stored as a secure hash — never in plain text)</li>
        <li>Links and notes you post to groups</li>
      </ul>

      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '1.5rem', marginBottom: '0.5rem' }}>How We Use Your Information</h2>
      <p>Your information is used solely to provide the Dropzone service — authenticating your account and displaying your posts to members of your groups. We do not sell, share, or use your data for advertising.</p>

      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '1.5rem', marginBottom: '0.5rem' }}>Third-Party Embeds</h2>
      <p>Dropzone may display embedded content from third-party platforms including YouTube, Facebook, TikTok, Spotify, Twitter/X, and Twitch. When embedded content loads, those platforms may collect data according to their own privacy policies.</p>

      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '1.5rem', marginBottom: '0.5rem' }}>Data Storage</h2>
      <p>All data is stored on a self-hosted private server. We do not use third-party cloud databases or analytics services.</p>

      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '1.5rem', marginBottom: '0.5rem' }}>Your Rights</h2>
      <p>You may request deletion of your account and all associated data at any time by contacting the app administrator.</p>

      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '1.5rem', marginBottom: '0.5rem' }}>Contact</h2>
      <p>This is a private self-hosted application. For any privacy questions or concerns, open a ticket in the Discord support server:</p>
      <a
        href="https://discord.gg/qEnkgupCmZ"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 1.25rem',
          borderRadius: 'var(--radius-sm)',
          background: '#5865F2',
          color: '#fff',
          fontWeight: 600,
          fontSize: '0.875rem',
          textDecoration: 'none',
          marginTop: '0.75rem',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
        </svg>
        Open a Ticket on Discord
      </a>
    </div>
  );
}
