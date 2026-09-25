import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCached, setCache } from '@/lib/tournamentCache';

export async function GET(request, { params }) {
  try {
    const { id } = await params;

    // ── Serve from cache if fresh ──────────────────────────────────
    const cached = getCached(id);
    if (cached) {
      return NextResponse.json(cached.data, {
        headers: {
          'Cache-Control': 'public, s-maxage=2, stale-while-revalidate=5',
          'X-Cache': 'HIT',
        },
      });
    }

    // ── Cache miss – query DB ──────────────────────────────────────
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        teams: {
          include: {
            sales: { include: { player: { include: { category: true } } } },
            owners: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
        players: {
          include: { category: true, sale: { include: { team: true } } },
          orderBy: { playerNumber: 'asc' },
        },
        categories: { orderBy: { sortOrder: 'asc' } },
        sponsors: { orderBy: { sortOrder: 'asc' } },
        auctionState: true,
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // ── Store in cache ─────────────────────────────────────────────
    const responseData = { tournament };
    setCache(id, responseData);

    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'public, s-maxage=2, stale-while-revalidate=5',
        'X-Cache': 'MISS',
      },
    });
  } catch (error) {
    console.error('Public get tournament error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
