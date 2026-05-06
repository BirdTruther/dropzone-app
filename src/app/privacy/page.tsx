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
      <p>This is a private self-hosted application. For any questions, contact the administrator directly.</p>
    </div>
  );
}
