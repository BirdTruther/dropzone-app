export default function TermsPage() {
  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '2rem 1rem', lineHeight: 1.7 }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Terms of Service</h1>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '2rem' }}>Last updated: May 2026</p>

      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '1.5rem', marginBottom: '0.5rem' }}>What is Dropzone?</h2>
      <p>Dropzone is a private, invite-only link-sharing application for small groups of trusted users. Access is granted solely by the administrator. By using Dropzone, you agree to these terms.</p>

      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '1.5rem', marginBottom: '0.5rem' }}>Eligibility</h2>
      <p>You must be invited by the app administrator to create an account. Dropzone is not open to the general public. You must be at least 13 years of age to use this service.</p>

      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '1.5rem', marginBottom: '0.5rem' }}>Acceptable Use</h2>
      <p>You agree not to use Dropzone to post or share content that is:</p>
      <ul style={{ paddingLeft: '1.25rem', marginTop: '0.5rem' }}>
        <li>Illegal under applicable law</li>
        <li>Harmful, threatening, or harassing to other users</li>
        <li>Content that infringes on the intellectual property rights of others</li>
        <li>Malware, spam, or any content intended to disrupt the service</li>
      </ul>

      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '1.5rem', marginBottom: '0.5rem' }}>Your Content</h2>
      <p>You retain ownership of any content you post. By posting, you grant the administrator a limited license to store and display your content to other members of your groups within the Dropzone platform. Your content is not shared publicly unless you explicitly use the share link feature.</p>

      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '1.5rem', marginBottom: '0.5rem' }}>Account Termination</h2>
      <p>The administrator reserves the right to suspend or delete any account at any time, particularly in cases of abuse or violation of these terms. You may also request deletion of your own account at any time via the Data Deletion page.</p>

      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '1.5rem', marginBottom: '0.5rem' }}>Disclaimer of Warranties</h2>
      <p>Dropzone is provided as-is for personal, non-commercial use. No guarantees are made regarding uptime, data retention, or availability. Use of this service is at your own risk.</p>

      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '1.5rem', marginBottom: '0.5rem' }}>Changes to These Terms</h2>
      <p>These terms may be updated at any time. Continued use of Dropzone after changes are posted constitutes acceptance of the revised terms.</p>

      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '1.5rem', marginBottom: '0.5rem' }}>Contact</h2>
      <p>This is a private self-hosted application. For any questions or concerns, contact the administrator directly.</p>
    </div>
  );
}
