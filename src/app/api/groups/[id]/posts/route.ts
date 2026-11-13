import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fetchLinkPreview } from '@/lib/og';
import { notifyGroupMembers } from '@/lib/notifications';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const member = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId: params.id } },
  });
  if (!member) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

  // Cursor pagination (v0.99.4): the feed used to load every post in the
  // group on every refresh. Default page is 25 posts; pass ?before=<ISO date>
  // &beforeId=<id> (from the previous page's nextCursor) for the next page.
  // A cursor (not an offset) means a new post arriving at the top while
  // scrolling never shifts the page boundary and skips a post.
  const search = req.nextUrl.searchParams;
  const limitRaw = Number(search.get('limit'));
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(Math.floor(limitRaw), 1), 100)
    : 25;
  const cursorCreatedAt = search.get('before');
  const cursorId = search.get('beforeId');
  let cursorWhere = {};
  if (cursorCreatedAt && cursorId) {
    const cursorDate = new Date(cursorCreatedAt);
    if (!Number.isNaN(cursorDate.getTime())) {
      cursorWhere = {
        OR: [
          { createdAt: { lt: cursorDate } },
          { createdAt: cursorDate, id: { lt: cursorId } },
        ],
      };
    }
  }

  const posts = await prisma.post.findMany({
    where: { groupId: params.id, ...cursorWhere },
    include: {
      author: { select: { id: true, name: true, avatar: true } },
      reactions: true,
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
  });
  const hasMore = posts.length > limit;
  const page = hasMore ? posts.slice(0, limit) : posts;
  const last = page[page.length - 1];
  return NextResponse.json({
    posts: page,
    hasMore,
    nextCursor: hasMore && last
      ? { before: last.createdAt.toISOString(), beforeId: last.id }
      : null,
  });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const member = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId: params.id } },
  });
  if (!member) return NextResponse.json({ error: 'Not a member' }, { status: 403 });
  const { url, note } = await req.json();
  if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 });
  const preview = await fetchLinkPreview(url);
  const post = await prisma.post.create({
    data: {
      url,
      note: note ?? null,
      title: preview.title ?? null,
      description: preview.description ?? null,
      image: preview.image ?? null,
      siteName: preview.siteName ?? null,
      authorId: session.user.id,
      groupId: params.id,
    },
    include: {
      author: { select: { id: true, name: true, avatar: true } },
      reactions: true,
    },
  });

  // Notify all other group members about the new post
  const postTitle = preview.title ? `"${preview.title.slice(0, 40)}${preview.title.length > 40 ? '…' : ''}"` : 'a link';
  notifyGroupMembers({
    groupId: params.id,
    actorId: session.user.id,
    type: 'new_post',
    message: `dropped ${postTitle}`,
  }).catch(() => {});

  return NextResponse.json(post, { status: 201 });
}
