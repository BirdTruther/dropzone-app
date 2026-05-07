import Link from 'next/link';
import ChangelogModal from '@/components/ChangelogModal';

export default function Footer() {
  return (
    <footer style={{
      borderTop: '1px solid var(--color-border)',
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
        color: 'var(--color-text-muted)',
        flexWrap: 'wrap',
      }}>
        <Link href="/privacy" style={{ color: 'inherit' }}>
          Privacy Policy
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/data-deletion" style={{ color: 'inherit' }}>
          Data Deletion
        </Link>
        <span aria-hidden="true">·</span>
        <ChangelogModal />
        <span aria-hidden="true">·</span>
        <span>© {new Date().getFullYear()} Dropzone</span>
      </div>
    </footer>
  );
}
