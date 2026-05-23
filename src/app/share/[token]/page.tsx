import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { Metadata } from 'next';
import Link from 'next/link';
import { timeAgo, isoDate, fullDate } from '@/lib/timeAgo';

const BASE_URL = process.env.NEXTAUTH_URL ?? 'https://link.birdsserver.cfd';

function isFacebookUrl(url: string | null): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.replace('www.', '');
    return ['facebook.com', 'm.facebook.com', 'fb.watch'].includes(host);
  } catch { return false; }
}

async function getPost(token: string) {
  const share = await prisma.shareToken.findUnique({
    where: { token },
    include: {
      post: {
        include: { author: { select: { name: true, avatar: true } } },
      },
    },
  });
  if (!share) return null;
  if (share.expiresAt && share.expiresAt < new Date()) return null;
  return share.post;
}

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const post = await getPost(params.token);
  if (!post) return { title: 'dropzone' };

  const isUploadedVideo = post.uploadType === 'video' && post.uploadUrl;
  const isImage = post.uploadType === 'image' && post.uploadUrl;
  const isFbVideo = isFacebookUrl(post.url);
  const title = post.note ?? post.title ?? `${post.author.name} dropped something`;
  const description = post.description ?? `Shared via dropzone`;
  const imageUrl = isImage ? `${BASE_URL}${post.uploadUrl}` : post.image ?? `${BASE_URL}/android-chrome-512x512.png`;
  const videoUrl = isUploadedVideo
    ? `${BASE_URL}${post.uploadUrl}`
    : isFbVideo
    ? `${BASE_URL}/api/share/${params.token}/video`
    : null;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: 'dropzone',
      images: [{ url: imageUrl, width: 1280, height: 720 }],
      ...(videoUrl ? {
        type: 'video.other',
        videos: [{ url: videoUrl, type: 'video/mp4', width: 1280, height: 720 }],
      } : { type: 'website' }),
    },
    twitter: {
      card: videoUrl ? 'player' : 'summary_large_image',
      title,
      description,
      images: [imageUrl],
      ...(videoUrl ? { players: [{ playerUrl: `${BASE_URL}/share/${params.token}`, streamUrl: videoUrl, width: 1280, height: 720 }] } : {}),
    },
    other: videoUrl ? {
      'og:video': videoUrl,
      'og:video:secure_url': videoUrl,
      'og:video:type': 'video/mp4',
      'og:video:width': '1280',
      'og:video:height': '720',
    } : {},
  };
}

export default async function SharePage({ params }: { params: { token: string } }) {
  const post = await getPost(params.token);
  if (!post) notFound();

  // Check session but NEVER redirect — the share preview page always renders.
  // If the user is already logged in, the CTA goes straight to the group.
  // If not, it goes to login with a callbackUrl.
  const session = await getServerSession(authOptions);
  const isLoggedIn = !!session;

  const isUploadedVideo = post.uploadType === 'video' && post.uploadUrl;
  const isImage = post.uploadType === 'image' && post.uploadUrl;
  const isFbVideo = isFacebookUrl(post.url);

  // For Facebook videos, check if the file has already been downloaded
  let fbVideoReady = false;
  if (isFbVideo && post.url) {
    const hash = crypto.createHash('sha256').update(post.url).digest('hex').slice(0, 16);
    const filePath = path.join(process.cwd(), 'public', 'uploads', `fb_${hash}.mp4`);
    fbVideoReady = existsSync(filePath);
  }

  const fbVideoUrl = isFbVideo ? `/api/share/${params.token}/video` : null;
  const groupUrl = `/groups/${post.groupId}`;
  const callbackUrl = encodeURIComponent(groupUrl);

  // CTA destination: go straight to the group if logged in, otherwise login first
  const ctaHref = isLoggedIn ? groupUrl : `/login?callbackUrl=${callbackUrl}`;
  const ctaLabel = isLoggedIn ? 'View in Dropzone →' : 'View on Dropzone →';
  const ctaSubtext = isLoggedIn
    ? 'You\'re signed in — jump straight to the group.'
    : 'This is a private share link. The group is invite-only.';

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div style={{ width: '100%', maxWidth: 640 }}>

        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <img src="/android-chrome-192x192.png" alt="dropzone" width={28} height={28} style={{ borderRadius: 6 }} />
          <span style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>dropzone</span>
        </div>

        {/* Post card */}
        <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12, overflow: 'hidden', marginBottom: '1.25rem' }}>

          {/* Uploaded video (non-Facebook) */}
          {isUploadedVideo && (
            <video controls autoPlay={false} style={{ width: '100%', maxHeight: 400, background: '#000', display: 'block' }}>
              <source src={`${BASE_URL}${post.uploadUrl}`} type="video/mp4" />
            </video>
          )}

          {/* Facebook video — ready to play */}
          {isFbVideo && fbVideoReady && fbVideoUrl && (
            <video controls autoPlay={false} style={{ width: '100%', maxHeight: 400, background: '#000', display: 'block' }}>
              <source src={fbVideoUrl} type="video/mp4" />
            </video>
          )}

          {/* Facebook video — still processing */}
          {isFbVideo && !fbVideoReady && (
            <div style={{ width: '100%', minHeight: 200, background: '#111', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <p style={{ color: '#666', fontSize: '0.85rem', textAlign: 'center', maxWidth: 260 }}>
                Video is being prepared — check back in a moment or open in Dropzone.
              </p>
            </div>
          )}

          {isImage && (
            <img src={`${BASE_URL}${post.uploadUrl}`} alt="shared image" style={{ width: '100%', maxHeight: 500, objectFit: 'cover', display: 'block' }} />
          )}

          {!isUploadedVideo && !isFbVideo && !isImage && post.image && (
            <img src={post.image} alt={post.title ?? 'preview'} style={{ width: '100%', maxHeight: 300, objectFit: 'cover', display: 'block' }} />
          )}

          <div style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              {post.author.avatar
                ? <img src={post.author.avatar} alt={post.author.name} width={24} height={24} style={{ borderRadius: '50%', objectFit: 'cover' }} />
                : <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#5b6af7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, color: '#fff' }}>{post.author.name[0].toUpperCase()}</div>
              }
              <span style={{ fontSize: '0.85rem', color: '#aaa' }}>{post.author.name} shared via dropzone</span>
              <time
                dateTime={isoDate(post.createdAt)}
                title={fullDate(post.createdAt)}
                style={{ fontSize: '0.78rem', color: '#555', marginLeft: 'auto', cursor: 'default', flexShrink: 0 }}
              >
                {timeAgo(post.createdAt)}
              </time>
            </div>

            {post.note && <p style={{ fontSize: '0.95rem', color: '#fff', marginBottom: '0.5rem' }}>{post.note}</p>}
            {post.title && !post.note && <p style={{ fontWeight: 600, fontSize: '0.95rem', color: '#fff', marginBottom: '0.25rem' }}>{post.title}</p>}
            {post.description && <p style={{ fontSize: '0.82rem', color: '#888', marginBottom: '0.5rem' }}>{post.description}</p>}
            {post.url && !post.uploadUrl && !isFbVideo && (
              <a href={post.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.78rem', color: '#5b6af7', wordBreak: 'break-all' }}>{post.url}</a>
            )}
          </div>
        </div>

        {/* CTA */}
        <div style={{ textAlign: 'center' }}>
          <Link
            href={ctaHref}
            style={{ display: 'inline-block', background: '#5b6af7', color: '#fff', fontWeight: 600, fontSize: '0.9rem', padding: '0.65rem 1.5rem', borderRadius: 8, textDecoration: 'none' }}
          >
            {ctaLabel}
          </Link>
          <p style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#555' }}>{ctaSubtext}</p>
        </div>
      </div>
    </div>
  );
}
