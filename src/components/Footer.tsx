import Link from 'next/link';

export default function Footer() {
  return (
    <footer style={{
      borderTop: '1px solid rgba(0,0,0,0.08)',
      padding: '1.25rem 1rem',
      marginTop: 'auto',
    }}>
      <div style={{
        maxWidth: '960px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1.5rem',
        fontSize: '0.8125rem',
        color: '#6b7280',
      }}>
        <Link href="/privacy" style={{ color: 'inherit', textDecoration: 'none' }}>
          Privacy Policy
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/data-deletion" style={{ color: 'inherit', textDecoration: 'none' }}>
          Data Deletion
        </Link>
        <span aria-hidden="true">·</span>
        <span>© {new Date().getFullYear()} Dropzone</span>
      </div>
    </footer>
  );
}
